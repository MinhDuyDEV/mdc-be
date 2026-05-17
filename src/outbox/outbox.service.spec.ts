import { Test } from "@nestjs/testing";
import { PrismaService } from "../infra/prisma";
import { OutboxService } from "./outbox.service";

describe("OutboxService", () => {
	let service: OutboxService;

	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [
				OutboxService,
				{
					provide: PrismaService,
					useValue: {
						outboxEvent: {
							create: jest.fn(),
						},
					},
				},
			],
		}).compile();

		service = module.get(OutboxService);
	});

	it("should emit event inside transaction", async () => {
		const mockTx = {
			outboxEvent: {
				create: jest.fn().mockResolvedValue({ id: "test-id" }),
			},
		};

		await service.emit(mockTx as any, {
			eventType: "user.created",
			aggregateType: "User",
			aggregateId: "user-123",
			payload: { email: "test@example.com" },
		});

		expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				eventType: "user.created",
				aggregateType: "User",
				aggregateId: "user-123",
				payload: { email: "test@example.com" },
				status: "PENDING",
			}),
		});
	});

	it("should emit event with minimal fields", async () => {
		const mockTx = {
			outboxEvent: {
				create: jest.fn().mockResolvedValue({ id: "test-id" }),
			},
		};

		await service.emit(mockTx as any, {
			eventType: "system.healthcheck",
			payload: { ok: true },
		});

		expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				eventType: "system.healthcheck",
				payload: { ok: true },
				status: "PENDING",
			}),
		});
	});

	it("should throw if called outside transaction", async () => {
		await expect(
			service.emit(null as any, {
				eventType: "test.event",
				payload: {},
			}),
		).rejects.toThrow(/must be called inside a Prisma transaction/);
	});

	it("should throw if tx has no outboxEvent create method", async () => {
		await expect(
			service.emit({} as any, {
				eventType: "test.event",
				payload: {},
			}),
		).rejects.toThrow(/must be called inside a Prisma transaction/);
	});
});
