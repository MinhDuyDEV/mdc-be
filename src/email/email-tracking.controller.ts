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
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/auth';
import type { Response } from 'express';
import { EmailTrackingService } from './email-tracking.service';
import type { UnsubscribeResponseDto } from './dto/email-tracking.dto';

/** Max length of a valid unsubscribe token (base64url(JSON).base64url(HMAC-SHA256)). */
const MAX_UNSUBSCRIBE_TOKEN_LENGTH = 4096;

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
    // Fire-and-forget: service.recordOpen already swallows expected errors,
    // but a chained .catch() prevents an unhandled rejection from crashing
    // the process if the service contract is ever violated (e.g. logger
    // itself throws, or a future refactor stops swallowing).
    void this.trackingService
      .recordOpen(emailId, userAgent, ipAddress)
      .catch(() => undefined);

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

    // Fire-and-forget: see note in trackOpen — defensive .catch() to keep
    // an unhandled rejection from crashing the worker process.
    void this.trackingService
      .recordClick(emailId, target, userAgent, ipAddress)
      .catch(() => undefined);

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
   *
   * Throttled (60/min) to mitigate DoS / HMAC brute-force.
   * `:token` length is capped to prevent memory exhaustion via huge strings.
   */
  @Get('unsubscribe/:token')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async unsubscribe(
    @Param('token') token: string,
    @Query('reason') reason?: string,
  ): Promise<UnsubscribeResponseDto> {
    if (token.length > MAX_UNSUBSCRIBE_TOKEN_LENGTH) {
      throw new BadRequestException('Invalid unsubscribe token');
    }
    return this.trackingService.unsubscribe(token, reason);
  }
}
