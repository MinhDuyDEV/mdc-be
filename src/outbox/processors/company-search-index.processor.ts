import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { SearchEngineService } from "../../infra/search-engine/search-engine.service";

interface CompanyCreatedPayload {
	companyId: string;
	name: string;
	slug: string;
}

interface CompanyUpdatedPayload {
	companyId: string;
}

@Injectable()
export class CompanySearchIndexProcessor {
	private readonly logger = new Logger(CompanySearchIndexProcessor.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly searchEngine: SearchEngineService,
	) {}

	@Cron(CronExpression.EVERY_10_SECONDS, {
		name: "company-search-index-processor",
		waitForCompletion: true,
	})
	async processCompanyEvents() {
		// TODO: Wire into OutboxProcessor dispatch
		this.logger.debug("Company search index processor tick");
	}

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
			},
		});

		if (!company) {
			this.logger.warn(`Company ${payload.companyId} not found for indexing`);
			return;
		}

		await this.searchEngine.index("companies", company.id, {
			name: company.name,
			slug: company.slug,
			industry: company.industry,
			description: company.description,
			verified: company.verified,
			followerCount: company.followerCount,
			memberCount: company.members.length,
			memberNames: company.members.map((m) => m.user.displayName),
		});

		this.logger.log(`Indexed company ${company.id} in Elasticsearch`);
	}

	async processCompanyUpdated(payload: CompanyUpdatedPayload): Promise<void> {
		await this.processCompanyCreated({
			companyId: payload.companyId,
			name: "",
			slug: "",
		});
	}
}
