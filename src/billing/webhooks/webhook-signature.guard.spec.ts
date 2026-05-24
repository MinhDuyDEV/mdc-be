import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import type { WebhookService } from './webhook.service';

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;
  let webhookService: Pick<WebhookService, 'verifySignature'>;

  const timestamp = Math.floor(Date.now() / 1000).toString();

  function contextFor(request: {
    headers?: Record<string, string | undefined>;
    rawBody?: Buffer | string;
    body?: unknown;
  }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-webhook-signature': 'signature',
            'x-webhook-timestamp': timestamp,
            ...request.headers,
          },
          rawBody: request.rawBody,
          body: request.body,
        }),
      }),
    } as any;
  }

  beforeEach(() => {
    webhookService = {
      verifySignature: jest.fn().mockReturnValue(true),
    };
    guard = new WebhookSignatureGuard(webhookService as WebhookService);
  });

  it('verifies signatures using buffer rawBody bytes', () => {
    const result = guard.canActivate(
      contextFor({ rawBody: Buffer.from('{"type":"invoice.paid"}') }),
    );

    expect(result).toBe(true);
    expect(webhookService.verifySignature).toHaveBeenCalledWith(
      '{"type":"invoice.paid"}',
      'signature',
      timestamp,
    );
  });

  it('verifies signatures using string rawBody bytes', () => {
    const result = guard.canActivate(
      contextFor({ rawBody: '{"type":"invoice.paid"}' }),
    );

    expect(result).toBe(true);
    expect(webhookService.verifySignature).toHaveBeenCalledWith(
      '{"type":"invoice.paid"}',
      'signature',
      timestamp,
    );
  });

  it('hard-fails when rawBody is missing instead of stringifying parsed body', () => {
    expect(() =>
      guard.canActivate(
        contextFor({ body: { type: 'invoice.paid', id: 'evt-1' } }),
      ),
    ).toThrow(InternalServerErrorException);
    expect(webhookService.verifySignature).not.toHaveBeenCalled();
  });

  it('rejects missing signature headers', () => {
    expect(() =>
      guard.canActivate(
        contextFor({
          headers: { 'x-webhook-signature': undefined },
          rawBody: '{}',
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects invalid timestamps', () => {
    expect(() =>
      guard.canActivate(
        contextFor({
          headers: { 'x-webhook-timestamp': 'not-a-timestamp' },
          rawBody: '{}',
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid signatures', () => {
    jest.spyOn(webhookService, 'verifySignature').mockReturnValue(false);

    expect(() => guard.canActivate(contextFor({ rawBody: '{}' }))).toThrow(
      UnauthorizedException,
    );
  });
});
