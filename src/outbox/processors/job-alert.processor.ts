import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { AlertFrequency, Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OutboxService } from '../outbox.service';

/**
 * Slice of a Job needed for saved-search matching. Salary fields arrive as
 * Prisma `Decimal`; we coerce with `Number()` for comparison.
 */
interface AlertJobSlice {
  id: string;
  companyId: string;
  employmentType: string;
  workplaceType: string;
  location: string | null;
  salaryMin: Prisma.Decimal | null;
  salaryMax: Prisma.Decimal | null;
  skills: Array<{ skillId: string }>;
}

/**
 * Slice of a SavedSearch `query` JSON blob. Mirrors `ListJobsQueryDto` field
 * names. `q` (full-text) is intentionally ignored — alert matching is a
 * structured filter match, not a tsvector search.
 */
interface AlertQuerySlice {
  companyId?: unknown;
  employmentType?: unknown;
  workplaceType?: unknown;
  location?: unknown;
  skillId?: unknown;
  salaryMin?: unknown;
  salaryMax?: unknown;
}

@Injectable()
export class JobAlertProcessor {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(JobAlertProcessor.name);
  }

  /**
   * Process REALTIME alerts when a new job is published.
   * Called from OutboxProcessor on JobPublished event.
   */
  async processJobPublished(payload: {
    jobId: string;
    companyId: string;
  }): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: payload.jobId },
      include: {
        company: { select: { name: true } },
        skills: { select: { skillId: true } },
      },
    });
    if (!job) return;

    // Only REALTIME saved searches with alerts enabled.
    const savedSearches = await this.prisma.savedSearch.findMany({
      where: { frequency: 'REALTIME', alertEnabled: true, deletedAt: null },
      include: { user: { select: { id: true, email: true } } },
    });

    for (const search of savedSearches) {
      const query = search.query as AlertQuerySlice;
      if (!this.jobMatchesQuery(job, query)) continue;

      // Dedup: skip if this search already got a delivery in the last 60s.
      const existing = await this.prisma.jobAlertDelivery.findFirst({
        where: {
          savedSearchId: search.id,
          deliveredAt: { gte: new Date(Date.now() - 60_000) },
        },
        select: { id: true },
      });
      if (existing) continue;

      const jobIds = [payload.jobId];
      // Record delivery + emit in-app notification event atomically.
      await this.prisma.$transaction(async (tx) => {
        const delivery = await tx.jobAlertDelivery.create({
          data: {
            savedSearchId: search.id,
            userId: search.userId,
            jobIds,
          },
        });
        await this.outboxService.emit(tx, {
          eventType: 'SavedSearchMatched',
          aggregateType: 'SavedSearch',
          aggregateId: delivery.id,
          payload: {
            savedSearchId: search.id,
            userId: search.userId,
            deliveryId: delivery.id,
            jobIds,
            searchName: search.name,
            frequency: 'REALTIME',
          },
        });
      });

      // Email is a separate best-effort channel.
      await this.sendSingleJobEmail(search.user.email, search.name, job);
    }
  }

  private jobMatchesQuery(job: AlertJobSlice, query: AlertQuerySlice): boolean {
    if (query.companyId && job.companyId !== query.companyId) return false;
    if (query.employmentType && job.employmentType !== query.employmentType) {
      return false;
    }
    if (query.workplaceType && job.workplaceType !== query.workplaceType) {
      return false;
    }
    if (
      query.location &&
      typeof query.location === 'string' &&
      job.location &&
      !job.location.toLowerCase().includes(query.location.toLowerCase())
    ) {
      return false;
    }
    // Skill: query.skillId must be among the job's skills.
    if (query.skillId && typeof query.skillId === 'string') {
      if (!job.skills.some((s) => s.skillId === query.skillId)) return false;
    }
    // Salary range overlap:
    //  - query.salaryMin: job's max must be >= wantMin (job must reach it).
    //  - query.salaryMax: job's min must be <= wantMax (job must not exceed it).
    // Jobs without a salary range never satisfy a salary filter.
    if (query.salaryMin !== undefined && query.salaryMin !== null) {
      const wantMin = Number(query.salaryMin);
      if (Number.isNaN(wantMin)) return false;
      const jobMax = job.salaryMax !== null ? Number(job.salaryMax) : null;
      if (jobMax === null || jobMax < wantMin) return false;
    }
    if (query.salaryMax !== undefined && query.salaryMax !== null) {
      const wantMax = Number(query.salaryMax);
      if (Number.isNaN(wantMax)) return false;
      const jobMin = job.salaryMin !== null ? Number(job.salaryMin) : null;
      if (jobMin === null || jobMin > wantMax) return false;
    }
    return true;
  }

  /** Cron: process DAILY alerts at 9 AM UTC */
  @Cron('0 9 * * *', { name: 'job-alert-daily' })
  async processDailyAlerts(): Promise<void> {
    await this.processAlertsByFrequency('DAILY');
  }

  /** Cron: process WEEKLY alerts on Mondays at 9 AM UTC */
  @Cron('0 9 * * 1', { name: 'job-alert-weekly' })
  async processWeeklyAlerts(): Promise<void> {
    await this.processAlertsByFrequency('WEEKLY');
  }

  private async processAlertsByFrequency(
    frequency: AlertFrequency,
  ): Promise<void> {
    this.logger.info('Processing %s job alerts', frequency);

    const savedSearches = await this.prisma.savedSearch.findMany({
      where: { frequency, alertEnabled: true, deletedAt: null },
      include: { user: { select: { id: true, email: true } } },
    });

    // Find recent jobs (last 24h for DAILY, last 7 days for WEEKLY).
    const lookback =
      frequency === 'WEEKLY' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - lookback);

    const recentJobs = await this.prisma.job.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: since },
        deletedAt: null,
      },
      include: {
        company: { select: { name: true } },
        skills: { select: { skillId: true } },
      },
    });

    for (const search of savedSearches) {
      const query = search.query as AlertQuerySlice;
      const matchingJobs = recentJobs.filter((job) =>
        this.jobMatchesQuery(job as AlertJobSlice, query),
      );
      if (matchingJobs.length === 0) continue;

      // Dedup: only jobs not yet delivered for this search.
      const delivered = await this.prisma.jobAlertDelivery.findMany({
        where: { savedSearchId: search.id },
        select: { jobIds: true },
      });
      const deliveredJobIds = new Set(
        delivered.flatMap((d) => d.jobIds as string[]),
      );
      const newJobs = matchingJobs.filter((j) => !deliveredJobIds.has(j.id));
      if (newJobs.length === 0) continue;

      const jobIds = newJobs.map((j) => j.id);
      await this.prisma.$transaction(async (tx) => {
        const delivery = await tx.jobAlertDelivery.create({
          data: {
            savedSearchId: search.id,
            userId: search.userId,
            jobIds,
          },
        });
        await this.outboxService.emit(tx, {
          eventType: 'SavedSearchMatched',
          aggregateType: 'SavedSearch',
          aggregateId: delivery.id,
          payload: {
            savedSearchId: search.id,
            userId: search.userId,
            deliveryId: delivery.id,
            jobIds,
            searchName: search.name,
            frequency,
          },
        });
      });

      await this.sendBatchEmail(search.user.email, search.name, newJobs);
    }
  }

  private async sendSingleJobEmail(
    to: string,
    searchName: string | null,
    job: {
      title: string;
      location: string | null;
      company?: { name: string } | null;
      createdAt: Date;
      id: string;
    },
  ): Promise<void> {
    try {
      await this.emailService.send({
        to,
        subject: `New job matching your saved search: ${job.title}`,
        template: 'job-alert',
        context: {
          jobTitle: job.title,
          companyName: job.company?.name ?? 'Unknown',
        },
      });
    } catch (err) {
      this.logger.warn(
        { err, to, searchName },
        'Failed to send REALTIME job-alert email — in-app notification still delivered',
      );
    }
  }

  private async sendBatchEmail(
    to: string,
    searchName: string | null,
    jobs: Array<{
      id: string;
      title: string;
      location: string | null;
      company?: { name: string } | null;
    }>,
  ): Promise<void> {
    try {
      await this.emailService.send({
        to,
        subject: `${jobs.length} new job(s) matching "${searchName ?? 'your search'}"`,
        template: 'job-alert',
        context: {
          jobCount: jobs.length,
          searchName: searchName ?? 'Job Alert',
        },
      });
    } catch (err) {
      this.logger.warn(
        { err, to, searchName, jobCount: jobs.length },
        'Failed to send batch job-alert email — in-app notification still delivered',
      );
    }
  }
}
