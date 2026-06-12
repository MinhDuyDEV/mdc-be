import { Test, TestingModule } from '@nestjs/testing';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailTrackingService } from './email-tracking.service';

describe('EmailTrackingController', () => {
  let controller: EmailTrackingController;
  let trackingService: jest.Mocked<EmailTrackingService>;

  beforeEach(async () => {
    trackingService = {
      recordOpen: jest.fn(),
      recordClick: jest.fn(),
      unsubscribe: jest.fn(),
      getOpenTrackingUrl: jest.fn(),
      getClickTrackingUrl: jest.fn(),
      getUnsubscribeUrl: jest.fn(),
      hasTrackingConsent: jest.fn(),
      hasMarketingConsent: jest.fn(),
      injectTrackingPixel: jest.fn(),
      rewriteLinks: jest.fn(),
    } as unknown as jest.Mocked<EmailTrackingService>;

    // Mock the static method
    (EmailTrackingService as any).getPixelGif = jest
      .fn()
      .mockReturnValue(Buffer.from('GIF89a', 'utf-8'));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailTrackingController],
      providers: [
        {
          provide: EmailTrackingService,
          useValue: trackingService,
        },
      ],
    }).compile();

    controller = module.get<EmailTrackingController>(EmailTrackingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('trackOpen', () => {
    it('should return GIF buffer and record open event', () => {
      trackingService.recordOpen.mockResolvedValue(undefined);

      const result = controller.trackOpen(
        '550e8400-e29b-41d4-a716-446655440000',
        'TestAgent',
        '127.0.0.1',
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(trackingService.recordOpen).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'TestAgent',
        '127.0.0.1',
      );
    });

    it('should still return GIF when recordOpen rejects (service is expected to swallow internally)', () => {
      // recordOpen contract: it should never throw — it owns its own try/catch.
      // The controller's `void` discards the promise; we test that the response
      // is still a GIF buffer even if a misbehaving service throws.
      trackingService.recordOpen.mockRejectedValue(new Error('DB error'));

      const result = controller.trackOpen(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('trackClick', () => {
    it('should redirect to original URL and record click event', () => {
      trackingService.recordClick.mockResolvedValue(undefined);
      const res = { redirect: jest.fn() };

      controller.trackClick(
        '550e8400-e29b-41d4-a716-446655440000',
        res as any,
        'https://example.com',
        'TestAgent',
        '127.0.0.1',
      );

      expect(res.redirect).toHaveBeenCalledWith(302, 'https://example.com');
      expect(trackingService.recordClick).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'https://example.com',
        'TestAgent',
        '127.0.0.1',
      );
    });

    it('should reject javascript: redirect (open-redirect guard)', () => {
      const res = { redirect: jest.fn() };
      expect(() =>
        controller.trackClick(
          '550e8400-e29b-41d4-a716-446655440000',
          res as any,
          'javascript:alert(1)',
        ),
      ).toThrow();
    });

    it('should reject missing redirect', () => {
      const res = { redirect: jest.fn() };
      expect(() =>
        controller.trackClick(
          '550e8400-e29b-41d4-a716-446655440000',
          res as any,
        ),
      ).toThrow();
    });

    it('should reject malformed redirect URL', () => {
      const res = { redirect: jest.fn() };
      expect(() =>
        controller.trackClick(
          '550e8400-e29b-41d4-a716-446655440000',
          res as any,
          'not a url',
        ),
      ).toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should call service.unsubscribe with token and reason', async () => {
      trackingService.unsubscribe.mockResolvedValue({
        success: true,
        message: 'Successfully unsubscribed',
      });

      const result = await controller.unsubscribe(
        'some-token',
        'Too many emails',
      );

      expect(result).toEqual({
        success: true,
        message: 'Successfully unsubscribed',
      });
      expect(trackingService.unsubscribe).toHaveBeenCalledWith(
        'some-token',
        'Too many emails',
      );
    });

    it('should call service.unsubscribe without reason', async () => {
      trackingService.unsubscribe.mockResolvedValue({
        success: true,
        message: 'Successfully unsubscribed',
      });

      const result = await controller.unsubscribe('some-token');

      expect(result.success).toBe(true);
      expect(trackingService.unsubscribe).toHaveBeenCalledWith(
        'some-token',
        undefined,
      );
    });

    it('should reject tokens longer than the cap (DoS mitigation)', async () => {
      const oversized = 'a'.repeat(4097);

      await expect(controller.unsubscribe(oversized)).rejects.toThrow();
      expect(trackingService.unsubscribe).not.toHaveBeenCalled();
    });
  });
});
