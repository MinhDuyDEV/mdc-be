import {
	BadRequestException,
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { WebhookService } from "./webhook.service";

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
	constructor(private readonly webhookService: WebhookService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const signature = request.headers["x-webhook-signature"];
		const timestamp = request.headers["x-webhook-timestamp"];

		if (!signature || !timestamp) {
			throw new UnauthorizedException("MISSING_WEBHOOK_SIGNATURE");
		}

		// Replay protection: reject events older than 5 minutes
		const eventTime = parseInt(timestamp as string, 10);
		const now = Math.floor(Date.now() / 1000);
		if (now - eventTime > 300) {
			throw new BadRequestException("WEBHOOK_TIMESTAMP_TOO_OLD");
		}

		const rawBody =
			(request as { rawBody?: string }).rawBody || JSON.stringify(request.body);
		const isValid = this.webhookService.verifySignature(
			rawBody,
			signature as string,
			timestamp as string,
		);

		if (!isValid) {
			throw new UnauthorizedException("INVALID_WEBHOOK_SIGNATURE");
		}

		return true;
	}
}
