import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class JobSearchIndexProcessor {
  private readonly logger = new Logger(JobSearchIndexProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async processJobCreated(payload: { jobId: string }): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: payload.jobId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!job) {
      this.logger.warn(
        `Job ${payload.jobId} not found for JobCreated indexing — skipping`,
      );
      return;
    }
    this.logger.debug(
      `JobCreated indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=${job.id}`,
    );
  }

  async processJobUpdated(payload: { jobId: string }): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: payload.jobId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!job) {
      this.logger.warn(
        `Job ${payload.jobId} not found for JobUpdated indexing — skipping`,
      );
      return;
    }
    this.logger.debug(
      `JobUpdated indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=${job.id}`,
    );
  }

  async processJobPublished(payload: { jobId: string }): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: payload.jobId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!job) {
      this.logger.warn(
        `Job ${payload.jobId} not found for JobPublished indexing — skipping`,
      );
      return;
    }
    this.logger.debug(
      `JobPublished indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=${job.id}`,
    );
  }

  async processJobClosed(payload: { jobId: string }): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: payload.jobId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!job) {
      this.logger.warn(
        `Job ${payload.jobId} not found for JobClosed indexing — skipping`,
      );
      return;
    }
    this.logger.debug(
      `JobClosed indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=${job.id}`,
    );
  }

  async processJobDeleted(payload: { jobId: string }): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: payload.jobId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!job) {
      this.logger.warn(
        `Job ${payload.jobId} not found for JobDeleted indexing — skipping`,
      );
      return;
    }
    this.logger.debug(
      `JobDeleted indexed (Postgres FT trigger handles search_vector); ES wiring deferred to Phase 9 — jobId=${job.id}`,
    );
  }
}
