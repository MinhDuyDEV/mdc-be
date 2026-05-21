import { Injectable, Logger } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SearchIndexService } from '../../search/search-index.service';

@Injectable()
export class JobSearchIndexProcessor {
  private readonly logger = new Logger(JobSearchIndexProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
  ) {}

  async processJobCreated(payload: { jobId: string }): Promise<void> {
    await this.indexJob(payload.jobId, 'JobCreated');
  }

  async processJobUpdated(payload: { jobId: string }): Promise<void> {
    await this.indexJob(payload.jobId, 'JobUpdated');
  }

  async processJobPublished(payload: { jobId: string }): Promise<void> {
    await this.indexJob(payload.jobId, 'JobPublished');
  }

  async processJobClosed(payload: { jobId: string }): Promise<void> {
    await this.indexJob(payload.jobId, 'JobClosed');
  }

  async processJobDeleted(payload: { jobId: string }): Promise<void> {
    await this.searchIndex.deleteByQuery('jobs', {
      term: { id: payload.jobId },
    });
    this.logger.log(`Removed job ${payload.jobId} from ES index`);
  }

  private async indexJob(jobId: string, eventType: string): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: {
          select: { id: true, name: true, slug: true },
        },
        skills: true,
      },
    });

    if (!job || job.deletedAt) {
      this.logger.warn(
        `Job ${jobId} not found or deleted for ${eventType} — skipping ES index`,
      );
      // Remove from ES if soft-deleted
      if (job?.deletedAt) {
        await this.searchIndex.deleteByQuery('jobs', { term: { id: jobId } });
      }
      return;
    }

    await this.searchIndex.indexDocument('jobs', job.id, {
      id: job.id,
      title: job.title,
      description: job.description,
      companyId: job.companyId,
      companyName: job.company?.name ?? '',
      companySlug: job.company?.slug ?? '',
      location: job.location,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      employmentType: job.employmentType,
      workplaceType: job.workplaceType,
      skills: job.skills.map((s) => s.skillId),
      status: job.status,
      publishedAt: job.publishedAt?.toISOString() ?? null,
      closedAt: job.closedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });

    this.logger.log(`Indexed job ${jobId} in ES (${eventType})`);
  }
}
