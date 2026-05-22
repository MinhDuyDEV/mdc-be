import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { OutboxService } from "../outbox/outbox.service";
import type { CreatePlanDto } from "./dto/create-plan.dto";
import type { UpdatePlanDto } from "./dto/update-plan.dto";

@Injectable()
export class BillingService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly outboxService: OutboxService,
	) {}

	async createPlan(data: CreatePlanDto) {
		return this.prisma.billingPlan.create({
			data: {
				name: data.name,
				slug: data.slug,
				description: data.description,
				features: data.features as Prisma.InputJsonValue,
				priceMonthly: data.priceMonthly,
				priceYearly: data.priceYearly,
				isPublic: data.isPublic ?? true,
			},
		});
	}

	async listPlans(isAdmin: boolean) {
		return this.prisma.billingPlan.findMany({
			where: isAdmin ? {} : { isPublic: true, isActive: true },
			orderBy: { priceMonthly: "asc" },
		});
	}

	async getPlan(planId: string) {
		const plan = await this.prisma.billingPlan.findUnique({
			where: { id: planId },
		});
		if (!plan) throw new NotFoundException("PLAN_NOT_FOUND");
		return plan;
	}

	async updatePlan(planId: string, data: UpdatePlanDto) {
		return this.prisma.billingPlan.update({
			where: { id: planId },
			data: {
				...data,
				features: data.features as Prisma.InputJsonValue | undefined,
			},
		});
	}
}
