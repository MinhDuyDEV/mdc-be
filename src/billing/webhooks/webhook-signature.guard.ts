import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';

interface WebhookRequest {
  headers: Record<string, string | undefined>;
  rawBody?: Buffer | string;
}

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    @Inject(WebhookService) private readonly webhookService: WebhookService,
  ) {}

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
