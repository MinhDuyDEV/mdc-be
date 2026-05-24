import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SearchIndexService } from '../../search/search-index.service';

interface CompanyCreatedPayload {
  companyId: string;
  name?: string;
  slug?: string;
}

interface CompanyUpdatedPayload {
  companyId: string;
}

@Injectable()
export class CompanySearchIndexProcessor {
  private readonly logger = new Logger(CompanySearchIndexProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
  ) {}

  async processCompanyCreated(payload: CompanyCreatedPayload): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: payload.companyId },
      include: {
        members: {
          include: {
            user: {
              select: { displayName: true },
            },
          },
        },
        _count: {
          select: {
            followers: true,
            members: true,
          },
        },
      },
    });

    if (!company) {
      this.logger.warn(`Company ${payload.companyId} not found for indexing`);
      return;
    }

    await this.searchIndex.indexDocument('companies', company.id, {
      name: company.name,
      slug: company.slug,
      industry: company.industry,
      description: company.description,
      verified: company.verified,
      followerCount: company._count.followers,
      memberCount: company._count.members,
      memberNames: company.members.map((m) => m.user.displayName),
    });

    this.logger.log(`Indexed company ${company.id} in Elasticsearch`);
  }

  async processCompanyUpdated(payload: CompanyUpdatedPayload): Promise<void> {
    await this.processCompanyCreated({
      companyId: payload.companyId,
      name: '',
      slug: '',
    });
  }
}
