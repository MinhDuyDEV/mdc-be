import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../outbox/idempotency.service';
import { OutboxService } from '../../outbox/outbox.service';
import { STRIPE_PORT } from '../ports/stripe.port';
import { StripeProrationService } from './stripe-proration.service';

describe('StripeProrationService', () => {
  let service: StripeProrationService;
  let mockPrisma: any;
  let mockStripePort: any;
  let mockOutbox: any;
  let mockIdempotency: any;

  beforeEach(async () => {
    mockPrisma = {
      subscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      billingPlan: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(mockPrisma)),
    };
    mockStripePort = {
      previewProration: jest.fn(),
      updateSubscription: jest.fn(),
      getSubscription: jest.fn(),
    };
    mockOutbox = { emit: jest.fn() };
    mockIdempotency = { claim: jest.fn().mockResolvedValue({ id: 'idem-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeProrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: STRIPE_PORT, useValue: mockStripePort },
        { provide: OutboxService, useValue: mockOutbox },
        { provide: IdempotencyService, useValue: mockIdempotency },
      ],
    }).compile();

    service = module.get<StripeProrationService>(StripeProrationService);
  });

  describe('previewChange', () => {
    it('returns proration preview', async () => {
      const sub = {
        id: 'sub-1',
        companyId: 'company-1',
        planId: 'plan-old',
        providerSubscriptionId: 'sub_stripe',
        providerCustomerId: 'cus_123',
      };
      const plan = { id: 'plan-new', name: 'Pro', priceMonthly: 2999 };
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockStripePort.previewProration.mockResolvedValue({
        amountDue: 1500,
        currency: 'usd',
        lineItems: [{ description: 'Proration', amount: 1500 }],
      });

      const result = await service.previewChange('company-1', 'plan-new');

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
      });
      expect(mockStripePort.previewProration).toHaveBeenCalledWith({
        customerId: 'cus_123',
        subscriptionId: 'sub_stripe',
        newPriceId: 'plan-new',
      });
      expect(result.amountDue).toBe(1500);
    });
  });

  describe('upgrade', () => {
    it('upgrades subscription and emits event', async () => {
      const sub = {
        id: 'sub-1',
        companyId: 'company-1',
        planId: 'plan-old',
        providerSubscriptionId: 'sub_stripe',
      };
      const plan = { id: 'plan-new', name: 'Pro', priceMonthly: 2999 };
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockStripePort.updateSubscription.mockResolvedValue({
        id: 'sub_stripe',
        status: 'active',
        currentPeriodEnd: Date.now() + 86400000,
      });
      mockPrisma.subscription.update.mockResolvedValue({
        ...sub,
        planId: 'plan-new',
      });

      const result = await service.upgrade('company-1', 'plan-new', 'idem-key');

      expect(mockIdempotency.claim).toHaveBeenCalledWith(
        'SubscriptionUpgrade',
        'idem-key',
      );
      expect(mockStripePort.updateSubscription).toHaveBeenCalledWith({
        subscriptionId: 'sub_stripe',
        priceId: 'plan-new',
        prorationBehavior: 'always_invoice',
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        data: { planId: 'plan-new' },
      });
      expect(mockOutbox.emit).toHaveBeenCalled();
      expect(result.planId).toBe('plan-new');
    });
  });

  describe('downgrade', () => {
    it('schedules downgrade and emits event', async () => {
      const sub = {
        id: 'sub-1',
        companyId: 'company-1',
        planId: 'plan-old',
        providerSubscriptionId: 'sub_stripe',
      };
      const plan = { id: 'plan-new', name: 'Basic' };
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockStripePort.updateSubscription.mockResolvedValue({
        id: 'sub_stripe',
        status: 'active',
        currentPeriodEnd: Date.now() + 86400000,
      });
      mockPrisma.subscription.update.mockResolvedValue({
        ...sub,
        scheduledPlanId: 'plan-new',
        cancelAtPeriodEnd: true,
      });

      const result = await service.downgrade(
        'company-1',
        'plan-new',
        'idem-key',
      );

      expect(mockIdempotency.claim).toHaveBeenCalledWith(
        'SubscriptionDowngrade',
        'idem-key',
      );
      expect(mockStripePort.updateSubscription).toHaveBeenCalledWith({
        subscriptionId: 'sub_stripe',
        prorationBehavior: 'none',
        cancelAtPeriodEnd: true,
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        data: { scheduledPlanId: 'plan-new', cancelAtPeriodEnd: true },
      });
      expect(mockOutbox.emit).toHaveBeenCalled();
      expect(result.scheduledPlanId).toBe('plan-new');
    });
  });
});
