import * as crypto from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { IdempotencyService } from "../../outbox/idempotency.service";
import { OutboxService } from "../../outbox/outbox.service";
import { WebhookService } from "./webhook.service";

describe("WebhookService", () => {
	let service: WebhookService;
	let mockPrisma: Record<string, any>;
	let mockOutboxService: { emit: jest.Mock };
	let mockIdempotencyService: { claim: jest.Mock };
	let mockConfigService: { get: jest.Mock };

	const secret = "whsec_test_secret";

	beforeEach(async () => {
		mockPrisma = {
			paymentProviderEvent: {
				create: jest.fn(),
			},
			$transaction: jest.fn((fn: any) => fn(mockPrisma)),
		};

		mockOutboxService = { emit: jest.fn() };
		mockIdempotencyService = { claim: jest.fn() };
		mockConfigService = {
			get: jest.fn().mockReturnValue(secret),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebhookService,
				{ provide: PrismaService, useValue: mockPrisma },
				{ provide: OutboxService, useValue: mockOutboxService },
				{ provide: IdempotencyService, useValue: mockIdempotencyService },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<WebhookService>(WebhookService);
	});

	describe("verifySignature", () => {
		it("returns true for valid signature", () => {
			const timestamp = Math.floor(Date.now() / 1000).toString();
			const payload = JSON.stringify({ type: "invoice.paid" });
			const signedPayload = `${timestamp}.${payload}`;
			const signature = crypto
				.createHmac("sha256", secret)
				.update(signedPayload)
				.digest("hex");

			const result = service.verifySignature(payload, signature, timestamp);

			expect(result).toBe(true);
		});

		it("returns false for invalid signature", () => {
			const timestamp = Math.floor(Date.now() / 1000).toString();
			const payload = JSON.stringify({ type: "invoice.paid" });
			// Use same-length hex string to avoid timingSafeEqual length mismatch
			const wrongSignature = "a".repeat(64);

			const result = service.verifySignature(
				payload,
				wrongSignature,
				timestamp,
			);

			expect(result).toBe(false);
		});

		it("returns false for tampered payload", () => {
			const timestamp = Math.floor(Date.now() / 1000).toString();
			const originalPayload = JSON.stringify({ type: "invoice.paid" });
			const signedPayload = `${timestamp}.${originalPayload}`;
			const signature = crypto
				.createHmac("sha256", secret)
				.update(signedPayload)
				.digest("hex");

			const tamperedPayload = JSON.stringify({ type: "invoice.canceled" });
			const result = service.verifySignature(
				tamperedPayload,
				signature,
				timestamp,
			);

			expect(result).toBe(false);
		});
	});

	describe("processWebhook", () => {
		it("creates PaymentProviderEvent and outbox event on success", async () => {
			const provider = "stripe";
			const eventId = "evt_123";
			const eventType = "invoice.paid";
			const payload = { type: "invoice.paid", data: { amount: 1000 } };

			mockIdempotencyService.claim.mockResolvedValue({ id: "key-1" });
			mockPrisma.paymentProviderEvent.create.mockResolvedValue({
				id: "ppe-1",
			});

			const result = await service.processWebhook(
				provider,
				eventId,
				eventType,
				payload,
			);

			expect(result).toEqual({ processed: true, eventId: "ppe-1" });
			expect(mockIdempotencyService.claim).toHaveBeenCalledWith(
				"WebhookEvent",
				"stripe:evt_123",
			);
			expect(mockPrisma.paymentProviderEvent.create).toHaveBeenCalledWith({
				data: {
					provider: "stripe",
					providerEventId: "evt_123",
					eventType: "invoice.paid",
					payload,
				},
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrisma,
				expect.objectContaining({
					eventType: "PaymentProviderEventReceived",
					aggregateType: "PaymentProviderEvent",
					aggregateId: "ppe-1",
					payload: {
						eventId: "ppe-1",
						provider: "stripe",
						eventType: "invoice.paid",
					},
				}),
			);
		});

		it("returns duplicate when idempotency claim fails", async () => {
			const provider = "stripe";
			const eventId = "evt_123";
			const eventType = "invoice.paid";
			const payload = { type: "invoice.paid" };

			mockIdempotencyService.claim.mockRejectedValue(
				new Error("Duplicate key"),
			);

			const result = await service.processWebhook(
				provider,
				eventId,
				eventType,
				payload,
			);

			expect(result).toEqual({ processed: false, reason: "duplicate" });
			expect(mockPrisma.paymentProviderEvent.create).not.toHaveBeenCalled();
			expect(mockOutboxService.emit).not.toHaveBeenCalled();
		});
	});
});
