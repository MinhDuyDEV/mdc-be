import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../infra/prisma/prisma.service";
import { IdempotencyService } from "../outbox/idempotency.service";
import { OutboxService } from "../outbox/outbox.service";
import { BillingService } from "./billing.service";

describe("BillingService", () => {
	let service: BillingService;
	let mockPrismaValue: any;
	let mockOutboxService: any;
	let mockIdempotencyService: any;

	beforeEach(async () => {
		mockPrismaValue = {
			billingPlan: {
				create: jest.fn(),
				findMany: jest.fn(),
				findUnique: jest.fn(),
				update: jest.fn(),
			},
			subscription: {
				create: jest.fn(),
				findUnique: jest.fn(),
				update: jest.fn(),
			},
			entitlementGrant: {
				create: jest.fn(),
			},
			companyEntitlement: {
				findFirst: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				upsert: jest.fn(),
			},
			invoice: {
				findMany: jest.fn(),
				findFirst: jest.fn(),
			},
			user: {
				findUnique: jest.fn(),
			},
			$transaction: jest.fn((fn: any) => fn(mockPrismaValue)),
		};

		mockOutboxService = { emit: jest.fn() };
		mockIdempotencyService = {
			claim: jest.fn().mockResolvedValue({ id: "idem-1" }),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BillingService,
				{ provide: PrismaService, useValue: mockPrismaValue },
				{ provide: OutboxService, useValue: mockOutboxService },
				{ provide: IdempotencyService, useValue: mockIdempotencyService },
			],
		}).compile();

		service = module.get<BillingService>(BillingService);
	});

	describe("createPlan", () => {
		it("creates plan with features JSON", async () => {
			const dto = {
				name: "Pro",
				slug: "pro",
				description: "Pro plan",
				features: { max_jobs: 50, max_members: 10 },
				priceMonthly: 2999,
				priceYearly: 29990,
				isPublic: true,
			};
			const created = { id: "plan-1", ...dto };
			mockPrismaValue.billingPlan.create.mockResolvedValue(created);

			const result = await service.createPlan(dto);

			expect(mockPrismaValue.billingPlan.create).toHaveBeenCalledWith({
				data: {
					name: "Pro",
					slug: "pro",
					description: "Pro plan",
					features: { max_jobs: 50, max_members: 10 },
					priceMonthly: 2999,
					priceYearly: 29990,
					isPublic: true,
				},
			});
			expect(result).toEqual(created);
		});
	});

	describe("listPlans", () => {
		it("filters by isPublic for non-admin", async () => {
			const plans = [{ id: "p1", name: "Free" }];
			mockPrismaValue.billingPlan.findMany.mockResolvedValue(plans);

			const result = await service.listPlans(false);

			expect(mockPrismaValue.billingPlan.findMany).toHaveBeenCalledWith({
				where: { isPublic: true, isActive: true },
				orderBy: { priceMonthly: "asc" },
			});
			expect(result).toEqual(plans);
		});

		it("returns all plans for admin", async () => {
			const plans = [{ id: "p1" }, { id: "p2" }];
			mockPrismaValue.billingPlan.findMany.mockResolvedValue(plans);

			const result = await service.listPlans(true);

			expect(mockPrismaValue.billingPlan.findMany).toHaveBeenCalledWith({
				where: {},
				orderBy: { priceMonthly: "asc" },
			});
			expect(result).toEqual(plans);
		});
	});

	describe("getPlan", () => {
		it("returns plan by id", async () => {
			const plan = { id: "plan-1", name: "Pro" };
			mockPrismaValue.billingPlan.findUnique.mockResolvedValue(plan);

			const result = await service.getPlan("plan-1");

			expect(mockPrismaValue.billingPlan.findUnique).toHaveBeenCalledWith({
				where: { id: "plan-1" },
			});
			expect(result).toEqual(plan);
		});

		it("throws NotFoundException when plan not found", async () => {
			mockPrismaValue.billingPlan.findUnique.mockResolvedValue(null);

			await expect(service.getPlan("missing")).rejects.toThrow(
				NotFoundException,
			);
			expect(mockPrismaValue.billingPlan.findUnique).toHaveBeenCalledWith({
				where: { id: "missing" },
			});
		});
	});

	describe("updatePlan", () => {
		it("updates plan fields", async () => {
			const dto = { name: "Updated Pro", priceMonthly: 3999 };
			const updated = {
				id: "plan-1",
				name: "Updated Pro",
				priceMonthly: 3999,
			};
			mockPrismaValue.billingPlan.update.mockResolvedValue(updated);

			const result = await service.updatePlan("plan-1", dto);

			expect(mockPrismaValue.billingPlan.update).toHaveBeenCalledWith({
				where: { id: "plan-1" },
				data: { name: "Updated Pro", priceMonthly: 3999 },
			});
			expect(result).toEqual(updated);
		});
	});

	describe("createSubscription", () => {
		const companyId = "company-1";
		const userId = "user-1";
		const planId = "plan-1";
		const dto = { planId };

		it("creates subscription + entitlement grants + outbox event", async () => {
			const plan = {
				id: planId,
				name: "Pro",
				features: { max_jobs: 10, max_members: 5 },
			};
			const subscription = {
				id: "sub-1",
				companyId,
				planId,
				status: "trialing",
				plan,
			};

			mockPrismaValue.user.findUnique.mockResolvedValue({
				id: userId,
				emailVerifiedAt: new Date(),
			});
			mockPrismaValue.subscription.findUnique.mockResolvedValue(null);
			mockPrismaValue.billingPlan.findUnique.mockResolvedValue(plan);
			mockPrismaValue.subscription.create.mockResolvedValue(subscription);
			mockPrismaValue.companyEntitlement.findFirst.mockResolvedValue(null);

			const result = await service.createSubscription(companyId, userId, dto);

			expect(mockPrismaValue.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: { emailVerifiedAt: true },
			});
			expect(mockPrismaValue.subscription.findUnique).toHaveBeenCalledWith({
				where: { companyId },
			});
			expect(mockIdempotencyService.claim).toHaveBeenCalledWith(
				"SubscriptionCreate",
				`${companyId}:${planId}`,
			);
			expect(mockPrismaValue.subscription.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					companyId,
					planId,
					status: "trialing",
				}),
				include: { plan: true },
			});
			// Entitlement grants for each feature
			expect(mockPrismaValue.entitlementGrant.create).toHaveBeenCalledTimes(2);
			expect(mockPrismaValue.entitlementGrant.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					subscriptionId: "sub-1",
					companyId,
					featureKey: "max_jobs",
					featureValue: 10,
				}),
			});
			expect(mockPrismaValue.entitlementGrant.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					subscriptionId: "sub-1",
					companyId,
					featureKey: "max_members",
					featureValue: 5,
				}),
			});
			// CompanyEntitlement for max_jobs
			expect(mockPrismaValue.companyEntitlement.findFirst).toHaveBeenCalledWith(
				{
					where: { companyId, entitlementType: "job_posts" },
				},
			);
			expect(mockPrismaValue.companyEntitlement.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					companyId,
					entitlementType: "job_posts",
					creditsTotal: 10,
					creditsRemaining: 10,
				}),
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "SubscriptionCreated",
					aggregateId: "sub-1",
				}),
			);
			expect(result).toEqual(subscription);
		});

		it("throws ConflictException if subscription exists", async () => {
			mockPrismaValue.user.findUnique.mockResolvedValue({
				id: userId,
				emailVerifiedAt: new Date(),
			});
			mockPrismaValue.subscription.findUnique.mockResolvedValue({
				id: "existing-sub",
			});

			await expect(
				service.createSubscription(companyId, userId, dto),
			).rejects.toThrow(ConflictException);
			expect(mockIdempotencyService.claim).not.toHaveBeenCalled();
			expect(mockPrismaValue.subscription.create).not.toHaveBeenCalled();
		});

		it("throws ForbiddenException if email not verified", async () => {
			mockPrismaValue.user.findUnique.mockResolvedValue({
				id: userId,
				emailVerifiedAt: null,
			});

			await expect(
				service.createSubscription(companyId, userId, dto),
			).rejects.toThrow(ForbiddenException);
			expect(mockIdempotencyService.claim).not.toHaveBeenCalled();
			expect(mockPrismaValue.subscription.create).not.toHaveBeenCalled();
		});
	});

	describe("cancelSubscription", () => {
		it("sets cancelAtPeriodEnd and emits event", async () => {
			const subscription = {
				id: "sub-1",
				companyId: "company-1",
				cancelAtPeriodEnd: true,
				canceledAt: new Date(),
			};
			mockPrismaValue.subscription.update.mockResolvedValue(subscription);

			const result = await service.cancelSubscription("company-1");

			expect(mockPrismaValue.subscription.update).toHaveBeenCalledWith({
				where: { companyId: "company-1" },
				data: {
					cancelAtPeriodEnd: true,
					canceledAt: expect.any(Date),
				},
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "SubscriptionCancelled",
					aggregateId: "sub-1",
				}),
			);
			expect(result).toEqual(subscription);
		});
	});

	describe("getSubscription", () => {
		it("returns subscription with plan", async () => {
			const subscription = {
				id: "sub-1",
				companyId: "company-1",
				plan: { id: "plan-1", name: "Pro" },
			};
			mockPrismaValue.subscription.findUnique.mockResolvedValue(subscription);

			const result = await service.getSubscription("company-1");

			expect(mockPrismaValue.subscription.findUnique).toHaveBeenCalledWith({
				where: { companyId: "company-1" },
				include: { plan: true },
			});
			expect(result).toEqual(subscription);
		});

		it("throws NotFoundException when not found", async () => {
			mockPrismaValue.subscription.findUnique.mockResolvedValue(null);

			await expect(service.getSubscription("missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("listInvoices", () => {
		it("returns paginated invoices", async () => {
			const invoices = [
				{ id: "inv-1", amount: 2999 },
				{ id: "inv-2", amount: 2999 },
			];
			mockPrismaValue.invoice.findMany.mockResolvedValue(invoices);

			const result = await service.listInvoices("company-1", { limit: 20 });

			expect(mockPrismaValue.invoice.findMany).toHaveBeenCalledWith({
				where: { companyId: "company-1" },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: 21,
			});
			expect(result.data).toEqual(invoices);
			expect(result.meta.hasMore).toBe(false);
			expect(result.meta.nextCursor).toBeNull();
		});

		it("returns hasMore=true when more results exist", async () => {
			const invoices = Array.from({ length: 21 }, (_, i) => ({
				id: `inv-${i + 1}`,
				amount: 2999,
			}));
			mockPrismaValue.invoice.findMany.mockResolvedValue(invoices);

			const result = await service.listInvoices("company-1", { limit: 20 });

			expect(result.data).toHaveLength(20);
			expect(result.meta.hasMore).toBe(true);
			expect(result.meta.nextCursor).toBe("inv-20");
		});
	});

	describe("getInvoice", () => {
		it("returns invoice with line items", async () => {
			const invoice = {
				id: "inv-1",
				companyId: "company-1",
				lineItems: [{ id: "li-1", description: "Pro plan" }],
			};
			mockPrismaValue.invoice.findFirst.mockResolvedValue(invoice);

			const result = await service.getInvoice("company-1", "inv-1");

			expect(mockPrismaValue.invoice.findFirst).toHaveBeenCalledWith({
				where: { id: "inv-1", companyId: "company-1" },
				include: { lineItems: true },
			});
			expect(result).toEqual(invoice);
		});

		it("throws NotFoundException when not found", async () => {
			mockPrismaValue.invoice.findFirst.mockResolvedValue(null);

			await expect(service.getInvoice("company-1", "missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
