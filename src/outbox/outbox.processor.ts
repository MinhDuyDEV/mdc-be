import { Injectable, Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import type { AppConfig } from "../infra/config";
import type { PrismaService } from "../infra/prisma";

@Injectable()
export class OutboxProcessor {
	private readonly logger = new Logger(OutboxProcessor.name);
	private readonly batchSize: number;
	private readonly maxRetries: number;
	private readonly baseBackoffMs: number;
	private readonly maxBackoffMs: number;

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService<AppConfig, true>,
	) {
		this.batchSize = this.config.get("outboxBatchSize", { infer: true });
		this.maxRetries = this.config.get("outboxMaxRetries", { infer: true });
		this.baseBackoffMs = this.config.get("outboxBaseBackoffMs", {
			infer: true,
		});
		this.maxBackoffMs = this.config.get("outboxMaxBackoffMs", { infer: true });
	}

	@Cron(CronExpression.EVERY_5_SECONDS, {
		name: "outbox-processor",
		waitForCompletion: true,
	})
	async processOutbox(): Promise<void> {
		try {
			const events = await this.claimEvents();
			// TODO: dispatch to handlers in future phases
			this.logger.debug(
				`Claimed ${events.length} outbox events for processing`,
			);
		} catch (err) {
			// Log but don't rethrow — that would kill the cron job
			this.logger.error("Outbox processing failed", err);
		}
	}

	async claimEvents(): Promise<any[]> {
		const lockId = randomUUID();

		return this.prisma.$transaction(async (tx) => {
			// 1. Atomically lock pending rows with SKIP LOCKED
			const claimed: Array<{ id: string }> = await tx.$queryRaw`
        SELECT id FROM outbox_events
        WHERE status = 'PENDING'::"OutboxEventStatus"
          AND available_at <= NOW()
        ORDER BY available_at ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      `;

			if (claimed.length === 0) return [];

			const ids = claimed.map((r) => r.id);

			// 2. Mark as PROCESSING
			await tx.$executeRaw`
        UPDATE outbox_events
        SET status = 'PROCESSING'::"OutboxEventStatus",
            locked_at = NOW(),
            locked_by = ${lockId}::uuid,
            attempts = attempts + 1
        WHERE id = ANY(${ids}::uuid[])
      `;

			// 3. Fetch full rows for the handler
			return tx.outboxEvent.findMany({
				where: { id: { in: ids }, lockedBy: lockId },
				orderBy: { createdAt: "asc" },
			});
		});
	}

	private calculateBackoff(attempt: number): number {
		const exp = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** attempt);
		return Math.random() * exp; // Full jitter
	}
}
