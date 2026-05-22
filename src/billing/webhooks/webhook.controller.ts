import {
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import { Public } from "../../common/auth/public.decorator";
import type { WebhookService } from "./webhook.service";
import { WebhookSignatureGuard } from "./webhook-signature.guard";

@Controller("billing/webhooks")
export class WebhookController {
	constructor(private readonly webhookService: WebhookService) {}

	@Post(":provider")
	@Public()
	@UseGuards(WebhookSignatureGuard)
	@HttpCode(HttpStatus.OK)
	async handleWebhook(
		@Param('provider') provider: string,
		@Body() body: Record<string, unknown>,
		@Headers('x-webhook-id') eventId: string,
	) {
		const eventType = body.type || body.event_type;
		const result = await this.webhookService.processWebhook(
			provider,
			eventId,
			eventType as string,
			body,
		);
		return { received: true, ...result };
	}
}
