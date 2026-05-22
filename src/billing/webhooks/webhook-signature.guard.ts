import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { WebhookService } from './webhook.service';

interface WebhookRequest {
  headers: Record<string, string | undefined>;
  body: unknown;
  rawBody?: Buffer | string;
}

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(private readonly webhookService: WebhookService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
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

    const rawBody: string =
      request.rawBody instanceof Buffer
        ? request.rawBody.toString('utf-8')
        : ((request.rawBody as string | undefined) ??
          JSON.stringify(request.body));
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
