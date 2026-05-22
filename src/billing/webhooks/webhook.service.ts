import * as crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../infra/config";
import type {
	PrismaService,
	PrismaTransaction,
} from "../../infra/prisma/prisma.service";
import type { IdempotencyService } from "../../outbox/idempotency.service";
import type { OutboxService } from "../../outbox/outbox.service";

@Injectable()
export class WebhookService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly outboxService: OutboxService,
		private readonly idempotencyService: IdempotencyService,
		private readonly configService: ConfigService<AppConfig, true>,
	) {}

	verifySignature(
		payload: string,
		signature: string,
		timestamp: string,
	): boolean {
		const secret = this.configService.get("billingWebhookSecret", {
			infer: true,
		});
		const signedPayload = `${timestamp}.${payload}`;
		const expectedSignature = crypto
			.createHmac("sha256", secret)
			.update(signedPayload)
			.digest("hex");

		return crypto.timingSafeEqual(
			Buffer.from(signature),
			Buffer.from(expectedSignature),
		);
	}

	async processWebhook(
		provider: string,
		eventId: string,
		eventType: string,
		payload: unknown,
	) {
		// Idempotency check
		const idempotencyKey = `${provider}:${eventId}`;
		try {
			await this.idempotencyService.claim("WebhookEvent", idempotencyKey);
		} catch {
			// Already processed
			return { processed: false, reason: "duplicate" };
		}

		return this.prisma.$transaction(async (tx) => {
			const event = await tx.paymentProviderEvent.create({
				data: {
					provider,
					providerEventId: eventId,
					eventType,
					payload: payload as object,
				},
			});

			await this.outboxService.emit(tx as PrismaTransaction, {
				eventType: "PaymentProviderEventReceived",
				aggregateType: "PaymentProviderEvent",
				aggregateId: event.id,
				payload: { eventId: event.id, provider, eventType },
			});

			return { processed: true, eventId: event.id };
		});
	}
}
