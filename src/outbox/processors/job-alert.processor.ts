import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { AlertFrequency } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class JobAlertProcessor {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService,
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
        skills: { include: { skill: true } },
      },
    });
    if (!job) return;

    // Find all REALTIME saved searches
    const rawSavedSearches = await this.prisma.savedSearch.findMany({
      where: { frequency: 'REALTIME', deletedAt: null },
      include: { user: { select: { id: true, email: true } } },
    });
    const savedSearches = rawSavedSearches as Array<
      (typeof rawSavedSearches)[number] & {
        user: { id: string; email: string };
      }
    >;

    for (const search of savedSearches) {
      const query = search.query as Record<string, unknown>;
      if (this.jobMatchesQuery(job, query)) {
        // Dedup: check if already delivered recently
        const existing = await this.prisma.jobAlertDelivery.findFirst({
          where: {
            savedSearchId: search.id,
            deliveredAt: { gte: new Date(Date.now() - 60_000) },
          },
        });
        if (existing) continue;

        // Record delivery and send email
        await this.prisma.jobAlertDelivery.create({
          data: {
            savedSearchId: search.id,
            userId: search.userId,
            jobIds: [payload.jobId],
          },
        });

        this.emailService.renderTemplate('job-alert', {
          jobTitle: job.title,
          companyName: job.company?.name ?? 'Unknown',
          location: job.location ?? 'Remote',
          postedAt: job.createdAt.toISOString(),
          jobUrl: `/jobs/${job.id}`,
        });

        await this.emailService.send({
          to: search.user.email,
          subject: `New job matching your saved search: ${job.title}`,
          template: 'job-alert',
          context: {
            jobTitle: job.title,
            companyName: job.company?.name ?? 'Unknown',
          },
        });
      }
    }
  }

  private jobMatchesQuery(
    job: Record<string, unknown>,
    query: Record<string, unknown>,
  ): boolean {
    // Simple matching: check employmentType, workplaceType, location, skillIds
    if (query.employmentType && job.employmentType !== query.employmentType) {
      return false;
    }
    if (query.workplaceType && job.workplaceType !== query.workplaceType) {
      return false;
    }
    if (
      query.location &&
      typeof job.location === 'string' &&
      !job.location
        .toLowerCase()
        .includes((query.location as string).toLowerCase())
    ) {
      return false;
    }
    // skill matching: if query has skillId, job must have that skill
    if (query.skillId) {
      const jobSkills =
        (job as { skills?: Array<{ skillId: string }> }).skills ?? [];
      if (!jobSkills.some((s) => s.skillId === query.skillId)) return false;
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

  private async processAlertsByFrequency(frequency: string): Promise<void> {
    this.logger.info('Processing %s job alerts', frequency);

    // Find saved searches for this frequency
    const rawSearches = await this.prisma.savedSearch.findMany({
      where: { frequency: frequency as AlertFrequency, deletedAt: null },
      include: { user: { select: { id: true, email: true } } },
    });
    const savedSearches = rawSearches as Array<
      (typeof rawSearches)[number] & {
        user: { id: string; email: string };
      }
    >;

    // Find recent jobs (last 24h for DAILY, last 7 days for WEEKLY)
    const lookback =
      frequency === 'WEEKLY' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - lookback);

    const recentJobs = await this.prisma.job.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: since },
        deletedAt: null,
      },
      include: { company: { select: { name: true } } },
    });

    for (const search of savedSearches) {
      const query = search.query as Record<string, unknown>;
      const matchingJobs = recentJobs.filter((job) =>
        this.jobMatchesQuery(job as unknown as Record<string, unknown>, query),
      );
      if (matchingJobs.length === 0) continue;

      // Dedup: check which jobs haven't been delivered for this search
      const delivered = await this.prisma.jobAlertDelivery.findMany({
        where: { savedSearchId: search.id },
        select: { jobIds: true },
      });
      const deliveredJobIds = new Set(
        delivered.flatMap((d) => d.jobIds as string[]),
      );
      const newJobs = matchingJobs.filter((j) => !deliveredJobIds.has(j.id));
      if (newJobs.length === 0) continue;

      // Record delivery
      await this.prisma.jobAlertDelivery.create({
        data: {
          savedSearchId: search.id,
          userId: search.userId,
          jobIds: newJobs.map((j) => j.id),
        },
      });

      // Send email
      this.emailService.renderTemplate('job-alert', {
        jobs: newJobs.map((j) => ({
          title: j.title,
          company: j.company?.name ?? 'Unknown',
          location: j.location ?? 'Remote',
          url: `/jobs/${j.id}`,
        })),
        searchName: search.name ?? 'Job Alert',
        frequency,
      });

      await this.emailService.send({
        to: search.user.email,
        subject: `${newJobs.length} new job(s) matching "${search.name ?? 'your search'}"`,
        template: 'job-alert',
        context: {
          jobCount: newJobs.length,
          searchName: search.name ?? 'Job Alert',
        },
      });
    }
  }
}
