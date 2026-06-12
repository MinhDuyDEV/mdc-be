import { createHmac } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailTrackingService } from './email-tracking.service';
import { PrismaService } from '../infra/prisma/prisma.service';

describe('EmailTrackingService', () => {
  let service: EmailTrackingService;
  let prisma: {
    emailTrackingEvent: { create: jest.Mock };
    emailConsent: { findUnique: jest.Mock; upsert: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      emailTrackingEvent: { create: jest.fn() },
      emailConsent: { findUnique: jest.fn(), upsert: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTrackingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                emailFrom: 'test@example.com',
                emailTrackingBaseUrl: 'https://mdc.local',
                emailUnsubscribeSecret: 'test-secret',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailTrackingService>(EmailTrackingService);
  });

  // ─── URL generation ───

  describe('getOpenTrackingUrl', () => {
    it('should generate correct open tracking URL', () => {
      const url = service.getOpenTrackingUrl('email-uuid-123');
      expect(url).toBe(
        'https://mdc.local/api/v1/email/track/open/email-uuid-123',
      );
    });
  });

  describe('getClickTrackingUrl', () => {
    it('should generate correct click tracking URL with encoded redirect', () => {
      const url = service.getClickTrackingUrl(
        'email-uuid-123',
        'https://example.com/job/456',
      );
      expect(url).toBe(
        'https://mdc.local/api/v1/email/track/click/email-uuid-123?redirect=https%3A%2F%2Fexample.com%2Fjob%2F456',
      );
    });
  });

  describe('getUnsubscribeUrl', () => {
    it('should generate unsubscribe URL with HMAC-signed token', () => {
      const url = service.getUnsubscribeUrl('user-uuid-1');
      expect(url).toMatch(
        /^https:\/\/mdc\.local\/api\/v1\/email\/unsubscribe\//,
      );

      // Token format: <base64url(payload)>.<base64url(hmacSha256)>
      const token = url.split('/').pop()!;
      const [payload, sig] = token.split('.');
      expect(payload).toBeTruthy();
      expect(sig).toBeTruthy();

      const decoded = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf-8'),
      );
      expect(decoded.userId).toBe('user-uuid-1');
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(Date.now());
    });
  });

  describe('getPixelGif', () => {
    it('should return a non-empty Buffer', () => {
      const gif = EmailTrackingService.getPixelGif();
      expect(gif).toBeInstanceOf(Buffer);
      expect(gif.length).toBeGreaterThan(0);
    });
  });

  // ─── Record events ───

  describe('recordOpen', () => {
    it('should create an OPENED tracking event', async () => {
      const expected = { id: 'evt-1' };
      prisma.emailTrackingEvent.create.mockResolvedValue(expected);

      await service.recordOpen('email-1', 'TestAgent', '127.0.0.1');

      expect(prisma.emailTrackingEvent.create).toHaveBeenCalledWith({
        data: {
          emailId: 'email-1',
          eventType: 'OPENED',
          userAgent: 'TestAgent',
          ipAddress: '127.0.0.1',
        },
      });
    });

    it('should not throw when DB write fails (best-effort)', async () => {
      prisma.emailTrackingEvent.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.recordOpen('email-1', 'Agent', '127.0.0.1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordClick', () => {
    it('should create a CLICKED tracking event', async () => {
      await service.recordClick(
        'email-1',
        'https://example.com',
        'TestAgent',
        '127.0.0.1',
      );

      expect(prisma.emailTrackingEvent.create).toHaveBeenCalledWith({
        data: {
          emailId: 'email-1',
          eventType: 'CLICKED',
          clickedUrl: 'https://example.com',
          userAgent: 'TestAgent',
          ipAddress: '127.0.0.1',
        },
      });
    });

    it('should not throw when DB write fails (best-effort)', async () => {
      prisma.emailTrackingEvent.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.recordClick('email-1', 'https://ex.com'),
      ).resolves.toBeUndefined();
    });
  });

  // ─── Consent checks ───

  describe('hasTrackingConsent', () => {
    it('should return true when consent record has trackingConsent=true', async () => {
      prisma.emailConsent.findUnique.mockResolvedValue({
        trackingConsent: true,
      });
      const result = await service.hasTrackingConsent('user-1');
      expect(result).toBe(true);
    });

    it('should return false when consent record has trackingConsent=false', async () => {
      prisma.emailConsent.findUnique.mockResolvedValue({
        trackingConsent: false,
      });
      const result = await service.hasTrackingConsent('user-1');
      expect(result).toBe(false);
    });

    it('should return false when no consent record exists', async () => {
      prisma.emailConsent.findUnique.mockResolvedValue(null);
      const result = await service.hasTrackingConsent('user-1');
      expect(result).toBe(false);
    });
  });

  describe('hasMarketingConsent', () => {
    it('should return true when user has marketing consent and not unsubscribed', async () => {
      prisma.emailConsent.findUnique.mockResolvedValue({
        marketingConsent: true,
        unsubscribedAt: null,
      });
      const result = await service.hasMarketingConsent('user-1');
      expect(result).toBe(true);
    });

    it('should return false when no consent record', async () => {
      prisma.emailConsent.findUnique.mockResolvedValue(null);
      const result = await service.hasMarketingConsent('user-1');
      expect(result).toBe(false);
    });

    it('should return false when user has unsubscribed', async () => {
      prisma.emailConsent.findUnique.mockResolvedValue({
        marketingConsent: true,
        unsubscribedAt: new Date(),
      });
      const result = await service.hasMarketingConsent('user-1');
      expect(result).toBe(false);
    });

    it('should return false when marketingConsent is false', async () => {
      prisma.emailConsent.findUnique.mockResolvedValue({
        marketingConsent: false,
        unsubscribedAt: null,
      });
      const result = await service.hasMarketingConsent('user-1');
      expect(result).toBe(false);
    });
  });

  // ─── HTML injection ───

  describe('injectTrackingPixel', () => {
    it('should inject pixel before </body>', () => {
      const html = '<html><body><p>Hello</p></body></html>';
      const result = service.injectTrackingPixel(html, 'email-1');
      expect(result).toContain('<img src="');
      expect(result).toContain('/api/v1/email/track/open/email-1');
      expect(result).toContain('</body>');
      // pixel should be before </body>
      const bodyIndex = result.indexOf('</body>');
      const pixelIndex = result.lastIndexOf('<img');
      expect(pixelIndex).toBeLessThan(bodyIndex);
    });

    it('should append pixel when no </body> tag', () => {
      const html = '<p>Hello</p>';
      const result = service.injectTrackingPixel(html, 'email-1');
      expect(result).toContain('<img src="');
      expect(result).toContain('</p><img'); // appended after content
    });
  });

  describe('rewriteLinks', () => {
    it('should rewrite http/https hrefs to tracking URLs', () => {
      const html =
        '<a href="https://example.com/job/123">Apply</a> <a href="http://other.com">Link</a>';
      const result = service.rewriteLinks(html, 'email-1');
      expect(result).toContain('/api/v1/email/track/click/email-1');
      expect(result).not.toContain('href="https://example.com/job/123"');
      expect(result).not.toContain('href="http://other.com"');
    });

    it('should NOT rewrite links already pointing to tracking domain', () => {
      const html =
        '<a href="https://mdc.local/api/v1/email/unsubscribe/token">Unsub</a>';
      const result = service.rewriteLinks(html, 'email-1');
      // Should not find the tracking click URL in the result for unsubscribe links
      expect(result).toContain(
        'href="https://mdc.local/api/v1/email/unsubscribe/token"',
      );
    });

    it('should not modify links without href', () => {
      const html = '<a>No href</a>';
      const result = service.rewriteLinks(html, 'email-1');
      expect(result).toBe('<a>No href</a>');
    });
  });

  // ─── Unsubscribe ───

  describe('unsubscribe', () => {
    it('should upsert consent record and return success for valid HMAC-signed token', async () => {
      // Build a properly HMAC-signed token using the same secret the service uses.
      const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const payload = Buffer.from(
        JSON.stringify({ userId: 'user-1', exp }),
      ).toString('base64url');
      const sig = createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('base64url');
      const token = `${payload}.${sig}`;
      prisma.emailConsent.upsert.mockResolvedValue({});

      const result = await service.unsubscribe(token);

      expect(result).toEqual({
        success: true,
        message: 'Successfully unsubscribed',
      });
      expect(prisma.emailConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          update: expect.objectContaining({
            marketingConsent: false,
            trackingConsent: false,
          }),
        }),
      );
    });

    it('should reject token with bad signature', async () => {
      const payload = Buffer.from(
        JSON.stringify({ userId: 'user-1', exp: Date.now() + 1000 }),
      ).toString('base64url');
      const token = `${payload}.invalidsignature`;

      const result = await service.unsubscribe(token);
      expect(result).toEqual({
        success: false,
        message: 'Invalid unsubscribe token',
      });
    });

    it('should reject expired token', async () => {
      const exp = Date.now() - 1000; // already expired
      const payload = Buffer.from(
        JSON.stringify({ userId: 'user-1', exp }),
      ).toString('base64url');
      const sig = createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('base64url');
      const token = `${payload}.${sig}`;

      const result = await service.unsubscribe(token);
      expect(result).toEqual({
        success: false,
        message: 'Invalid or expired unsubscribe token',
      });
    });

    it('should reject malformed token (no dot separator)', async () => {
      const result = await service.unsubscribe('not-a-valid-token');
      expect(result).toEqual({
        success: false,
        message: 'Invalid unsubscribe token',
      });
    });

    it('should pass reason to upsert when provided', async () => {
      const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const payload = Buffer.from(
        JSON.stringify({ userId: 'user-1', exp }),
      ).toString('base64url');
      const sig = createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('base64url');
      const token = `${payload}.${sig}`;
      prisma.emailConsent.upsert.mockResolvedValue({});

      await service.unsubscribe(token, 'Too many emails');

      expect(prisma.emailConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            unsubscribeReason: 'Too many emails',
          }),
        }),
      );
    });
  });
});
