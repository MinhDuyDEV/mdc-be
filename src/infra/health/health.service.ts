import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config";
import type { MailerHealthService } from "../mailer";
import type { PrismaService } from "../prisma";
import type { RedisHealthService } from "../redis";
import type { SearchEngineHealthService } from "../search-engine";
import type { StorageHealthService } from "../storage";

export interface HealthDependencyStatus {
	status: "up" | "down";
	lag?: number;
	threshold?: number;
	error?: string;
}

export interface HealthResponse {
	status: "ok" | "error";
	checks: {
		api?: HealthDependencyStatus;
		postgres?: HealthDependencyStatus;
		redis?: HealthDependencyStatus;
		s3?: HealthDependencyStatus;
		elasticsearch?: HealthDependencyStatus;
		mail?: HealthDependencyStatus;
		outbox?: HealthDependencyStatus;
	};
}

@Injectable()
export class HealthService {
	private readonly outboxHealthLagThreshold: number;

	constructor(
		private readonly prisma: PrismaService,
		private readonly redisHealth: RedisHealthService,
		private readonly storageHealth: StorageHealthService,
		private readonly searchEngineHealth: SearchEngineHealthService,
		private readonly mailerHealth: MailerHealthService,
		private readonly configService: ConfigService<AppConfig, true>,
	) {
		this.outboxHealthLagThreshold = this.configService.get(
			"outboxHealthLagThreshold",
			{ infer: true },
		);
	}

	live(): HealthResponse {
		return {
			status: "ok",
			checks: {
				api: { status: "up" },
			},
		};
	}

	private async withTimeout<T>(
		operation: () => Promise<T>,
		timeoutMs: number,
	): Promise<T> {
		let timeout: NodeJS.Timeout | undefined;
		try {
			return await Promise.race([
				operation(),
				new Promise<never>((_resolve, reject) => {
					timeout = setTimeout(
						() => reject(new Error("Health check timed out")),
						timeoutMs,
					);
				}),
			]);
		} finally {
			if (timeout !== undefined) {
				clearTimeout(timeout);
			}
		}
	}

	async ready(): Promise<HealthResponse> {
		const checks: HealthResponse["checks"] = {};
		let status: HealthResponse["status"] = "ok";

		try {
			await this.withTimeout(
				() => this.prisma.$queryRaw`SELECT 1`,
				this.configService.get("healthDatabaseTimeoutMs", { infer: true }),
			);
			checks.postgres = { status: "up" };
		} catch {
			checks.postgres = { status: "down" };
			status = "error";
		}

		try {
			await this.redisHealth.ping();
			checks.redis = { status: "up" };
		} catch {
			checks.redis = { status: "down" };
			status = "error";
		}

		try {
			await this.withTimeout(
				() => this.storageHealth.ping(),
				this.configService.get("healthS3TimeoutMs", { infer: true }),
			);
			checks.s3 = { status: "up" };
		} catch {
			checks.s3 = { status: "down" };
			status = "error";
		}

		try {
			await this.withTimeout(
				() => this.searchEngineHealth.ping(),
				this.configService.get("healthElasticsearchTimeoutMs", { infer: true }),
			);
			checks.elasticsearch = { status: "up" };
		} catch {
			checks.elasticsearch = { status: "down" };
			status = "error";
		}

		try {
			await this.withTimeout(
				() => this.mailerHealth.ping(),
				this.configService.get("healthMailerTimeoutMs", { infer: true }),
			);
			checks.mail = { status: "up" };
		} catch {
			checks.mail = { status: "down" };
			status = "error";
		}

		try {
			const outboxCheck = await this.checkOutbox();
			checks.outbox = outboxCheck;
			if (outboxCheck.status === "down") {
				status = "error";
			}
		} catch {
			checks.outbox = { status: "down" };
			status = "error";
		}

		return { status, checks };
	}

	private async checkOutbox(): Promise<HealthDependencyStatus> {
		try {
			const result = await this.withTimeout(async () => {
				const [{ count }] = await this.prisma.$queryRaw<
					Array<{ count: bigint }>
				>`
          SELECT COUNT(*) as count
          FROM outbox_events
          WHERE status = 'PENDING'::"OutboxEventStatus"
        `;
				return Number(count);
			}, 5000);

			return {
				status: result <= this.outboxHealthLagThreshold ? "up" : "down",
				lag: result,
				threshold: this.outboxHealthLagThreshold,
			};
		} catch (err: any) {
			return { status: "down", error: err.message };
		}
	}
}
