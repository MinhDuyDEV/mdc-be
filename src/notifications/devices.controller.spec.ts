import { DevicesController } from './devices.controller';

describe('DevicesController', () => {
  const mockUser = { id: 'user-1', email: 'test@test.com' };

  function createMocks() {
    const mockDevicesService = {
      register: jest.fn(),
      unregister: jest.fn(),
      list: jest.fn(),
    };

    const controller = new DevicesController(mockDevicesService as any);
    return { controller, mockDevicesService };
  }

  describe('POST /devices', () => {
    it('delegates to DevicesService.register', async () => {
      const { controller, mockDevicesService } = createMocks();
      const dto = { deviceType: 'ios' as const, deviceToken: 'token-abc' };
      const expected = { id: 'd1' };
      mockDevicesService.register.mockResolvedValue(expected);

      const result = await controller.register(mockUser, dto);

      expect(mockDevicesService.register).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('DELETE /devices/:id', () => {
    it('delegates to DevicesService.unregister', async () => {
      const { controller, mockDevicesService } = createMocks();
      mockDevicesService.unregister.mockResolvedValue(undefined);

      const result = await controller.unregister(mockUser, 'device-1');

      expect(mockDevicesService.unregister).toHaveBeenCalledWith(
        'user-1',
        'device-1',
      );
      expect(result).toEqual({ message: 'Device unregistered' });
    });
  });

  describe('GET /devices', () => {
    it('delegates to DevicesService.list', async () => {
      const { controller, mockDevicesService } = createMocks();
      const expected = [{ id: 'd1' }];
      mockDevicesService.list.mockResolvedValue(expected);

      const result = await controller.list(mockUser);

      expect(mockDevicesService.list).toHaveBeenCalledWith('user-1');
      expect(result).toBe(expected);
    });
  });
});
