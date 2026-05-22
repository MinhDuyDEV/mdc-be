import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../infra/config";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class SubscriptionProcessor {
	private readonly logger = new Logger(SubscriptionProcessor.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService<AppConfig, true>,
	) {}

	async createFreeSubscription(companyId: string) {
		const existing = await this.prisma.subscription.findUnique({
			where: { companyId },
		});
		if (existing) {
			this.logger.debug(`Company ${companyId} already has subscription`);
			return;
		}

		const freePlanSlug = this.configService.get("billingDefaultFreePlanSlug", {
			infer: true,
		});
		const freePlan = await this.prisma.billingPlan.findUnique({
			where: { slug: freePlanSlug },
		});

		if (!freePlan) {
			this.logger.warn(`Free plan '${freePlanSlug}' not found`);
			return;
		}

		const now = new Date();
		const periodEnd = new Date(now);
		periodEnd.setFullYear(periodEnd.getFullYear() + 100); // Effectively permanent

		await this.prisma.subscription.create({
			data: {
				companyId,
				planId: freePlan.id,
				status: "active",
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
			},
		});

		this.logger.log(`Created free subscription for company ${companyId}`);
	}
}
