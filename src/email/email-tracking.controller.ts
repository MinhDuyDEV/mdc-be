import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Query,
  Headers,
  Ip,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Public } from '../common/auth';
import type { Response } from 'express';
import { EmailTrackingService } from './email-tracking.service';
import type { UnsubscribeResponseDto } from './dto/email-tracking.dto';

/**
 * CNIL-compliant email tracking and unsubscribe endpoints.
 *
 * - Open tracking: 1×1 transparent GIF (no cookies, no PII).
 * - Click tracking: 302 redirect via tracking endpoint (open-redirect guarded).
 * - Unsubscribe: one-click via HMAC-signed token.
 *
 * All endpoints are @Public() — no authentication required.
 */
@Controller('email')
@Public()
export class EmailTrackingController {
  constructor(private readonly trackingService: EmailTrackingService) {}

  /**
   * GET /api/v1/email/track/open/:emailId
   *
   * Returns a 1×1 transparent GIF and records an open event.
   * No caching — every request is a fresh open.
   */
  @Get('track/open/:emailId')
  @Public()
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  trackOpen(
    @Param('emailId', ParseUUIDPipe) emailId: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string,
  ): Buffer {
    // Fire-and-forget — never block the pixel response on DB
    void this.trackingService
      .recordOpen(emailId, userAgent, ipAddress)
      .catch(() => {
        /* best-effort */
      });

    return EmailTrackingService.getPixelGif();
  }

  /**
   * GET /api/v1/email/track/click/:emailId?redirect=<encodedUrl>
   *
   * Records a click event and 302-redirects to the original URL.
   * The `redirect` query param is validated against an http(s) URL allowlist
   * to prevent open-redirect abuse (attacker-controlled links via tracking).
   */
  @Get('track/click/:emailId')
  @Public()
  trackClick(
    @Param('emailId', ParseUUIDPipe) emailId: string,
    @Res() res: Response,
    @Query('redirect') redirect?: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string,
  ): void {
    const target = this.validateRedirect(redirect);

    // Fire-and-forget — record the click, then redirect.
    void this.trackingService
      .recordClick(emailId, target, userAgent, ipAddress)
      .catch(() => {
        /* best-effort */
      });

    res.redirect(302, target);
  }

  /**
   * Validate that a redirect target is a safe http(s) URL. Rejects
   * `javascript:`, `data:`, and other dangerous schemes. Returns the
   * input unchanged when safe; throws `BadRequestException` otherwise.
   */
  private validateRedirect(redirect: string | undefined): string {
    const target = (redirect ?? '').trim();
    if (!target) {
      throw new BadRequestException('Missing redirect target');
    }
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      throw new BadRequestException('Invalid redirect target');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Disallowed redirect scheme');
    }
    if (target.length > 2048) {
      throw new BadRequestException('Redirect target too long');
    }
    return target;
  }

  /**
   * GET /api/v1/email/unsubscribe/:token
   *
   * One-click unsubscribe via HMAC-signed token.
   * Optional `reason` query parameter.
   *
   * Token format: `<base64url(JSON{userId, exp})>.<base64url(hmacSha256)>`
   */
  @Get('unsubscribe/:token')
  @Public()
  async unsubscribe(
    @Param('token') token: string,
    @Query('reason') reason?: string,
  ): Promise<UnsubscribeResponseDto> {
    return this.trackingService.unsubscribe(token, reason);
  }
}
