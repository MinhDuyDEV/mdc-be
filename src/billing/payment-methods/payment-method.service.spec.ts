import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OutboxService } from '../../outbox/outbox.service';
import { STRIPE_PORT } from '../ports/stripe.port';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;
  let mockPrisma: any;
  let mockStripePort: any;
  let mockOutbox: any;

  beforeEach(async () => {
    mockPrisma = {
      paymentMethod: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(mockPrisma)),
    };
    mockStripePort = {
      createSetupIntent: jest.fn(),
      attachPaymentMethod: jest.fn(),
      detachPaymentMethod: jest.fn(),
      setDefaultPaymentMethod: jest.fn(),
      listPaymentMethods: jest.fn(),
      createCustomer: jest.fn(),
    };
    mockOutbox = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: STRIPE_PORT, useValue: mockStripePort },
        { provide: OutboxService, useValue: mockOutbox },
      ],
    }).compile();

    service = module.get<PaymentMethodService>(PaymentMethodService);
  });

  describe('createSetupIntent', () => {
    it('creates setup intent with existing provider customer', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        companyId: 'company-1',
        providerCustomerId: 'cus_123',
      });
      mockStripePort.createSetupIntent.mockResolvedValue({
        clientSecret: 'seti_secret_456',
      });

      const result = await service.createSetupIntent('company-1');

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
      });
      expect(mockStripePort.createSetupIntent).toHaveBeenCalledWith('cus_123');
      expect(result).toEqual({ clientSecret: 'seti_secret_456' });
    });

    it('creates stripe customer if none exists', async () => {
      const company = { id: 'company-1', name: 'Test Inc' };
      mockPrisma.subscription.findUnique.mockResolvedValue({
        companyId: 'company-1',
        providerCustomerId: null,
      });
      mockPrisma.company = {
        findUnique: jest.fn().mockResolvedValue(company),
      };
      mockStripePort.createCustomer.mockResolvedValue({ id: 'cus_new' });
      mockStripePort.createSetupIntent.mockResolvedValue({
        clientSecret: 'seti_secret_new',
      });
      mockPrisma.subscription.update = jest.fn();

      const result = await service.createSetupIntent('company-1');

      expect(mockStripePort.createCustomer).toHaveBeenCalledWith({
        email: expect.any(String),
        name: 'Test Inc',
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalled();
      expect(result).toEqual({ clientSecret: 'seti_secret_new' });
    });
  });

  describe('listPaymentMethods', () => {
    it('returns payment methods from db', async () => {
      const methods = [{ id: 'pm-1', type: 'card', last4: '4242' }];
      mockPrisma.paymentMethod.findMany.mockResolvedValue(methods);

      const result = await service.listPaymentMethods('company-1');

      expect(mockPrisma.paymentMethod.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1', status: 'active' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(methods);
    });
  });

  describe('setDefault', () => {
    it('sets default and emits event', async () => {
      const pm = { id: 'pm-1', companyId: 'company-1', type: 'card' };
      mockPrisma.paymentMethod.findFirst.mockResolvedValue(pm);
      mockPrisma.paymentMethod.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.paymentMethod.update.mockResolvedValue({
        ...pm,
        isDefault: true,
      });

      const result = await service.setDefault('company-1', 'pm-1');

      expect(mockPrisma.paymentMethod.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1', isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrisma.paymentMethod.update).toHaveBeenCalledWith({
        where: { id: 'pm-1' },
        data: { isDefault: true },
      });
      expect(mockOutbox.emit).toHaveBeenCalled();
      expect(result.isDefault).toBe(true);
    });

    it('throws not found', async () => {
      mockPrisma.paymentMethod.findFirst.mockResolvedValue(null);

      await expect(service.setDefault('company-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removePaymentMethod', () => {
    it('revokes payment method', async () => {
      const pm = {
        id: 'pm-1',
        companyId: 'company-1',
        providerMethodId: 'pm_stripe',
      };
      mockPrisma.paymentMethod.findFirst.mockResolvedValue(pm);
      mockStripePort.detachPaymentMethod.mockResolvedValue(undefined);
      mockPrisma.paymentMethod.update.mockResolvedValue({
        ...pm,
        status: 'revoked',
      });

      const result = await service.removePaymentMethod('company-1', 'pm-1');

      expect(mockStripePort.detachPaymentMethod).toHaveBeenCalledWith(
        'pm_stripe',
      );
      expect(mockPrisma.paymentMethod.update).toHaveBeenCalledWith({
        where: { id: 'pm-1' },
        data: { status: 'revoked' },
      });
      expect(mockOutbox.emit).toHaveBeenCalled();
      expect(result.status).toBe('revoked');
    });
  });
});
