import { Test, type TestingModule } from '@nestjs/testing';
import { CompanyRoleGuard } from '../../common/guards/company-role.guard';
import { PaymentMethodController } from './payment-method.controller';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodController', () => {
  let controller: PaymentMethodController;
  let mockService: any;

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    mockService = {
      createSetupIntent: jest.fn(),
      listPaymentMethods: jest.fn(),
      setDefault: jest.fn(),
      removePaymentMethod: jest.fn(),
      attachPaymentMethod: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodController],
      providers: [{ provide: PaymentMethodService, useValue: mockService }],
    })
      .overrideGuard(CompanyRoleGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<PaymentMethodController>(PaymentMethodController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createSetupIntent', () => {
    it('calls service.createSetupIntent', async () => {
      mockService.createSetupIntent.mockResolvedValue({
        clientSecret: 'secret',
      });

      const result = await controller.createSetupIntent('company-1');

      expect(mockService.createSetupIntent).toHaveBeenCalledWith('company-1');
      expect(result).toEqual({ clientSecret: 'secret' });
    });
  });

  describe('listPaymentMethods', () => {
    it('calls service.listPaymentMethods', async () => {
      const methods = [{ id: 'pm-1', type: 'card' }];
      mockService.listPaymentMethods.mockResolvedValue(methods);

      const result = await controller.listPaymentMethods('company-1');

      expect(mockService.listPaymentMethods).toHaveBeenCalledWith('company-1');
      expect(result).toEqual(methods);
    });
  });

  describe('setDefault', () => {
    it('calls service.setDefault', async () => {
      const updated = { id: 'pm-1', isDefault: true };
      mockService.setDefault.mockResolvedValue(updated);

      const result = await controller.setDefault('company-1', 'pm-1');

      expect(mockService.setDefault).toHaveBeenCalledWith('company-1', 'pm-1');
      expect(result).toEqual(updated);
    });
  });

  describe('removePaymentMethod', () => {
    it('calls service.removePaymentMethod', async () => {
      const removed = { id: 'pm-1', status: 'revoked' };
      mockService.removePaymentMethod.mockResolvedValue(removed);

      const result = await controller.removePaymentMethod('company-1', 'pm-1');

      expect(mockService.removePaymentMethod).toHaveBeenCalledWith(
        'company-1',
        'pm-1',
      );
      expect(result).toEqual(removed);
    });
  });
});
