import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
	PrismaService,
	PrismaTransaction,
} from "../infra/prisma/prisma.service";
import type { IdempotencyService } from "../outbox/idempotency.service";
import type { OutboxService } from "../outbox/outbox.service";
import type { CreatePlanDto } from "./dto/create-plan.dto";
import type { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import type { UpdatePlanDto } from "./dto/update-plan.dto";

@Injectable()
export class BillingService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly outboxService: OutboxService,
		private readonly idempotencyService: IdempotencyService,
	) {}

	// ── Plan CRUD ────────────────────────────────────────────────────────

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

	// ── Subscription Management ──────────────────────────────────────────

	async createSubscription(
		companyId: string,
		userId: string,
		data: CreateSubscriptionDto,
	) {
		// Check email verified
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { emailVerifiedAt: true },
		});
		if (!user?.emailVerifiedAt) {
			throw new ForbiddenException("EMAIL_NOT_VERIFIED");
		}

		// Check existing subscription
		const existing = await this.prisma.subscription.findUnique({
			where: { companyId },
		});
		if (existing) {
			throw new ConflictException("SUBSCRIPTION_ALREADY_EXISTS");
		}

		// Idempotency
		await this.idempotencyService.claim(
			"SubscriptionCreate",
			`${companyId}:${data.planId}`,
		);

		// Get plan
		const plan = await this.getPlan(data.planId);

		return this.prisma.$transaction(async (tx) => {
			const now = new Date();
			const periodEnd = new Date(now);
			periodEnd.setMonth(periodEnd.getMonth() + 1);

			const subscription = await tx.subscription.create({
				data: {
					companyId,
					planId: plan.id,
					status: "trialing",
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
				},
				include: { plan: true },
			});

			// Create entitlement grants
			await this.grantEntitlementsFromPlan(
				tx,
				subscription.id,
				companyId,
				plan,
				now,
				periodEnd,
			);

			await this.outboxService.emit(tx as PrismaTransaction, {
				eventType: "SubscriptionCreated",
				aggregateType: "Subscription",
				aggregateId: subscription.id,
				payload: {
					subscriptionId: subscription.id,
					companyId,
					planId: plan.id,
				},
			});

			return subscription;
		});
	}

	async getSubscription(companyId: string) {
		const subscription = await this.prisma.subscription.findUnique({
			where: { companyId },
			include: { plan: true },
		});
		if (!subscription) throw new NotFoundException("SUBSCRIPTION_NOT_FOUND");
		return subscription;
	}

	async cancelSubscription(companyId: string) {
		return this.prisma.$transaction(async (tx) => {
			const subscription = await tx.subscription.update({
				where: { companyId },
				data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
			});

			await this.outboxService.emit(tx as PrismaTransaction, {
				eventType: "SubscriptionCancelled",
				aggregateType: "Subscription",
				aggregateId: subscription.id,
				payload: { subscriptionId: subscription.id, companyId },
			});

			return subscription;
		});
	}

	private async grantEntitlementsFromPlan(
		tx: Prisma.TransactionClient,
		subscriptionId: string,
		companyId: string,
		plan: { features: Prisma.JsonValue },
		validFrom: Date,
		validUntil: Date,
	) {
		const features = plan.features as Record<string, number>;
		for (const [key, value] of Object.entries(features)) {
			await tx.entitlementGrant.create({
				data: {
					subscriptionId,
					companyId,
					featureKey: key,
					featureValue: value,
					validFrom,
					validUntil,
				},
			});

			// Update CompanyEntitlement materialized view
			if (key === "max_jobs") {
				const existing = await tx.companyEntitlement.findFirst({
					where: { companyId, entitlementType: "job_posts" },
				});

				if (existing) {
					await tx.companyEntitlement.update({
						where: { id: existing.id },
						data: {
							creditsTotal: value,
							creditsRemaining: value,
							validFrom,
							validUntil,
						},
					});
				} else {
					await tx.companyEntitlement.create({
						data: {
							companyId,
							entitlementType: "job_posts",
							creditsTotal: value,
							creditsRemaining: value,
							validFrom,
							validUntil,
						},
					});
				}
			}
		}
	}

	// ── Invoices ─────────────────────────────────────────────────────────

	async listInvoices(
		companyId: string,
		query: { cursor?: string; limit?: number },
	) {
		const limit = Math.min(query.limit ?? 20, 100);
		const cursor = query.cursor;

		const rows = await this.prisma.invoice.findMany({
			where: { companyId },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: limit + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});

		const hasMore = rows.length > limit;
		const data = hasMore ? rows.slice(0, limit) : rows;
		const nextCursor =
			hasMore && data.length > 0 ? data[data.length - 1].id : null;

		return { data, meta: { nextCursor, hasMore } };
	}

	async getInvoice(companyId: string, invoiceId: string) {
		const invoice = await this.prisma.invoice.findFirst({
			where: { id: invoiceId, companyId },
			include: { lineItems: true },
		});
		if (!invoice) throw new NotFoundException("INVOICE_NOT_FOUND");
		return invoice;
	}
}
