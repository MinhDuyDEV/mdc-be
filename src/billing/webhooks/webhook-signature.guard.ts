import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../infra/config';
import { STRIPE_PORT, type StripePort } from '../ports/stripe.port';
import { WebhookService } from './webhook.service';

interface WebhookRequest {
  headers: Record<string, string | undefined>;
  rawBody?: Buffer | string;
  params?: { provider?: string };
}

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    @Inject(WebhookService) private readonly webhookService: WebhookService,
    @Inject(STRIPE_PORT) private readonly stripePort: StripePort,
    @Inject(ConfigService)
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const provider = request.params?.provider ?? '';

    if (provider === 'stripe') {
      return this.verifyStripeSignature(request);
    }

    // Legacy HMAC verification
    return this.verifyHmacSignature(request);
  }

  private verifyStripeSignature(request: WebhookRequest): boolean {
    const signature = request.headers['stripe-signature'];
    if (!signature) {
      throw new UnauthorizedException('MISSING_STRIPE_SIGNATURE');
    }
    const requestRawBody = request.rawBody;
    if (requestRawBody === undefined) {
      throw new InternalServerErrorException(
        'Raw body required for Stripe webhook signature verification',
      );
    }

    try {
      this.stripePort.constructWebhookEvent(requestRawBody, signature);
      return true;
    } catch {
      throw new UnauthorizedException('INVALID_STRIPE_SIGNATURE');
    }
  }

  private verifyHmacSignature(request: WebhookRequest): boolean {
    const signature = request.headers['x-webhook-signature'];
    const timestamp = request.headers['x-webhook-timestamp'];

    if (!signature || !timestamp) {
      throw new UnauthorizedException('MISSING_WEBHOOK_SIGNATURE');
    }

    // Replay protection: reject events older than 5 minutes
    const eventTime = parseInt(timestamp, 10);
    if (isNaN(eventTime)) {
      throw new BadRequestException('INVALID_WEBHOOK_TIMESTAMP');
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - eventTime > 300) {
      throw new BadRequestException('WEBHOOK_TIMESTAMP_TOO_OLD');
    }

    const requestRawBody = request.rawBody;
    if (requestRawBody === undefined) {
      throw new InternalServerErrorException(
        'Raw body required for webhook signature verification',
      );
    }

    const rawBody =
      typeof requestRawBody === 'string'
        ? requestRawBody
        : requestRawBody.toString('utf-8');
    const isValid = this.webhookService.verifySignature(
      rawBody,
      signature,
      timestamp,
    );

    if (!isValid) {
      throw new UnauthorizedException('INVALID_WEBHOOK_SIGNATURE');
    }

    return true;
  }
}
