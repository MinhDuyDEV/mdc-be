import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../infra/config/app-config';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { UnsubscribeResponseDto } from './dto/email-tracking.dto';

/**
 * Tracks email opens (via 1x1 transparent pixel), clicks (via redirect),
 * and manages unsubscribe with CNIL-compliant consent.
 *
 * Security notes (v1):
 * - Unsubscribe token is HMAC-SHA256 signed JSON `{userId, exp}` keyed by
 *   `emailUnsubscribeSecret`. The signature prevents token forgery (an attacker
 *   who knows a `userId` UUID cannot forge an unsubscribe token).
 * - Tracking base URL is read via `ConfigService` (type-safe).
 * - No cookies, no PII in tracking URLs.
 * - Tracking only fires when `hasTrackingConsent` is true.
 */
@Injectable()
export class EmailTrackingService {
  private readonly logger = new Logger(EmailTrackingService.name);
  private readonly trackingBaseUrl: string;
  private readonly unsubscribeSecret: string;
  private static readonly UNSUBSCRIBE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  /** 1×1 transparent GIF pixel */
  private static readonly PIXEL_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.trackingBaseUrl = this.configService.get('emailTrackingBaseUrl', {
      infer: true,
    });
    this.unsubscribeSecret = this.configService.get('emailUnsubscribeSecret', {
      infer: true,
    });
  }

  // ────────────────────── Pixel / GIF ──────────────────────

  /** Returns the 1×1 transparent GIF Buffer. */
  static getPixelGif(): Buffer {
    return EmailTrackingService.PIXEL_GIF;
  }

  // ────────────────────── URL generation ──────────────────────

  /** Generate open-tracking pixel URL for an email. */
  getOpenTrackingUrl(emailId: string): string {
    return `${this.trackingBaseUrl}/api/v1/email/track/open/${emailId}`;
  }

  /** Generate click-tracking redirect URL for an email. */
  getClickTrackingUrl(emailId: string, originalUrl: string): string {
    const encoded = encodeURIComponent(originalUrl);
    return `${this.trackingBaseUrl}/api/v1/email/track/click/${emailId}?redirect=${encoded}`;
  }

  /**
   * Generate unsubscribe URL with HMAC-signed token (`{userId, exp}.sig`).
   * Signature prevents an attacker from forging tokens for arbitrary userIds.
   */
  getUnsubscribeUrl(userId: string): string {
    const exp = Date.now() + EmailTrackingService.UNSUBSCRIBE_TTL_MS;
    const payload = Buffer.from(JSON.stringify({ userId, exp })).toString(
      'base64url',
    );
    const sig = this.signToken(payload);
    return `${this.trackingBaseUrl}/api/v1/email/unsubscribe/${payload}.${sig}`;
  }

  private signToken(payload: string): string {
    return createHmac('sha256', this.unsubscribeSecret)
      .update(payload)
      .digest('base64url');
  }

  // ────────────────────── Record events ──────────────────────

  /** Record an open event (fire-and-forget, best-effort). */
  async recordOpen(
    emailId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.emailTrackingEvent.create({
        data: {
          emailId,
          eventType: 'OPENED',
          userAgent,
          ipAddress,
        },
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to record open event: ${err.message}`);
    }
  }

  /** Record a click event (fire-and-forget, best-effort). */
  async recordClick(
    emailId: string,
    clickedUrl: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.emailTrackingEvent.create({
        data: {
          emailId,
          eventType: 'CLICKED',
          clickedUrl,
          userAgent,
          ipAddress,
        },
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to record click event: ${err.message}`);
    }
  }

  // ────────────────────── Consent checks ──────────────────────

  /** Check whether a user has explicitly consented to email tracking. */
  async hasTrackingConsent(userId: string): Promise<boolean> {
    const consent = await this.prisma.emailConsent.findUnique({
      where: { userId },
    });
    return consent?.trackingConsent ?? false;
  }

  /**
   * Check whether a user has marketing consent (not unsubscribed).
   * Returns false when no consent record exists or user has unsubscribed.
   */
  async hasMarketingConsent(userId: string): Promise<boolean> {
    const consent = await this.prisma.emailConsent.findUnique({
      where: { userId },
    });
    if (!consent) return false;
    if (consent.unsubscribedAt) return false;
    return consent.marketingConsent;
  }

  // ────────────────────── HTML injection ──────────────────────

  /**
   * Inject tracking pixel before `</body>`.
   * If the HTML has no `</body>`, appends pixel at the end.
   */
  injectTrackingPixel(html: string, emailId: string): string {
    const pixelUrl = this.getOpenTrackingUrl(emailId);
    const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

    if (html.includes('</body>')) {
      return html.replace('</body>', `${pixel}</body>`);
    }
    return html + pixel;
  }

  /**
   * Rewrite all external http/https links to go through click-tracking.
   * Does NOT rewrite links that already point to the tracking base URL
   * (prevents double-rewriting unsubscribe links).
   */
  rewriteLinks(html: string, emailId: string): string {
    return html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url: string) => {
      // Don't rewrite links already pointing to our tracking domain
      if (url.startsWith(this.trackingBaseUrl)) {
        return `href="${url}"`;
      }
      return `href="${this.getClickTrackingUrl(emailId, url)}"`;
    });
  }

  // ────────────────────── Unsubscribe ──────────────────────

  /**
   * Process an unsubscribe request. Verifies HMAC signature and expiry before
   * flipping the user's `EmailConsent` to unsubscribed.
   *
   * Token format: `<base64url(JSON{userId, exp})>.<base64url(hmacSha256)>`
   */
  async unsubscribe(
    token: string,
    reason?: string,
  ): Promise<UnsubscribeResponseDto> {
    try {
      const dotIndex = token.indexOf('.');
      if (dotIndex < 0) {
        return { success: false, message: 'Invalid unsubscribe token' };
      }
      const payload = token.slice(0, dotIndex);
      const providedSig = token.slice(dotIndex + 1);

      const expectedSig = this.signToken(payload);
      const provided = Buffer.from(providedSig);
      const expected = Buffer.from(expectedSig);
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        return { success: false, message: 'Invalid unsubscribe token' };
      }

      const decoded = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf-8'),
      ) as {
        userId?: unknown;
        exp?: unknown;
      };
      if (
        typeof decoded.userId !== 'string' ||
        typeof decoded.exp !== 'number' ||
        decoded.exp < Date.now()
      ) {
        return {
          success: false,
          message: 'Invalid or expired unsubscribe token',
        };
      }
      const { userId } = decoded;

      await this.prisma.emailConsent.upsert({
        where: { userId },
        update: {
          unsubscribedAt: new Date(),
          unsubscribeReason: reason ?? null,
          marketingConsent: false,
          trackingConsent: false,
        },
        create: {
          userId,
          unsubscribedAt: new Date(),
          unsubscribeReason: reason ?? null,
          marketingConsent: false,
          trackingConsent: false,
        },
      });

      this.logger.log(`User ${userId} unsubscribed`);
      return { success: true, message: 'Successfully unsubscribed' };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Unsubscribe failed: ${err.message}`);
      return { success: false, message: 'Invalid unsubscribe token' };
    }
  }
}
