import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, type PinoLogger } from "nestjs-pino";
import type { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class JobSearchIndexProcessor {
	constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(JobSearchIndexProcessor.name)
    private readonly logger: PinoLogger,
  ) {}

	async processJobCreated(payload: { jobId: string }): Promise<void> {
		const job = await this.prisma.job.findUnique({
			where: { id: payload.jobId },
			select: { id: true, status: true, deletedAt: true },
		});
		if (!job) {
			this.logger.warn(
				"Job %s not found for JobCreated indexing — skipping",
				payload.jobId,
			);
			return;
		}
		this.logger.debug(
			"JobCreated indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=%s",
			job.id,
		);
	}

	async processJobUpdated(payload: { jobId: string }): Promise<void> {
		const job = await this.prisma.job.findUnique({
			where: { id: payload.jobId },
			select: { id: true, status: true, deletedAt: true },
		});
		if (!job) {
			this.logger.warn(
				"Job %s not found for JobUpdated indexing — skipping",
				payload.jobId,
			);
			return;
		}
		this.logger.debug(
			"JobUpdated indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=%s",
			job.id,
		);
	}

	async processJobPublished(payload: { jobId: string }): Promise<void> {
		const job = await this.prisma.job.findUnique({
			where: { id: payload.jobId },
			select: { id: true, status: true, deletedAt: true },
		});
		if (!job) {
			this.logger.warn(
				"Job %s not found for JobPublished indexing — skipping",
				payload.jobId,
			);
			return;
		}
		this.logger.debug(
			"JobPublished indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=%s",
			job.id,
		);
	}

	async processJobClosed(payload: { jobId: string }): Promise<void> {
		const job = await this.prisma.job.findUnique({
			where: { id: payload.jobId },
			select: { id: true, status: true, deletedAt: true },
		});
		if (!job) {
			this.logger.warn(
				"Job %s not found for JobClosed indexing — skipping",
				payload.jobId,
			);
			return;
		}
		this.logger.debug(
			"JobClosed indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=%s",
			job.id,
		);
	}

	async processJobDeleted(payload: { jobId: string }): Promise<void> {
		const job = await this.prisma.job.findUnique({
			where: { id: payload.jobId },
			select: { id: true, status: true, deletedAt: true },
		});
		if (!job) {
			this.logger.warn(
				"Job %s not found for JobDeleted indexing — skipping",
				payload.jobId,
			);
			return;
		}
		this.logger.debug(
			"JobDeleted indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=%s",
			job.id,
		);
	}
}
