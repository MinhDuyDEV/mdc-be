import { NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  function createMocks() {
    const mockPrisma = {
      userDevice: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const service = new DevicesService(mockPrisma as any);
    return { service, mockPrisma };
  }

  describe('register', () => {
    it('creates a new device when token does not exist', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.userDevice.findFirst.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'new-device-id',
        userId: 'user-1',
        deviceType: 'ios',
        deviceToken: 'token-abc',
        lastSeenAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.register('user-1', {
        deviceType: 'ios',
        deviceToken: 'token-abc',
      });

      expect(mockPrisma.userDevice.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', deviceToken: 'token-abc' },
      });
      expect(mockPrisma.userDevice.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          deviceType: 'ios',
          deviceToken: 'token-abc',
          lastSeenAt: expect.any(Date),
        },
      });
      expect(result.id).toBe('new-device-id');
    });

    it('updates existing device when token already exists', async () => {
      const { service, mockPrisma } = createMocks();
      const existingDevice = {
        id: 'existing-id',
        userId: 'user-1',
        deviceType: 'android',
        deviceToken: 'token-abc',
        lastSeenAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
      };
      mockPrisma.userDevice.findFirst.mockResolvedValue(existingDevice);
      mockPrisma.userDevice.update.mockResolvedValue({
        ...existingDevice,
        deviceType: 'ios',
        lastSeenAt: new Date(),
      });

      await service.register('user-1', {
        deviceType: 'ios',
        deviceToken: 'token-abc',
      });

      expect(mockPrisma.userDevice.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', deviceToken: 'token-abc' },
      });
      expect(mockPrisma.userDevice.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: {
          deviceType: 'ios',
          deviceToken: 'token-abc',
          lastSeenAt: expect.any(Date),
        },
      });
      expect(mockPrisma.userDevice.create).not.toHaveBeenCalled();
    });
  });

  describe('unregister', () => {
    it('deletes device when it exists and belongs to user', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.userDevice.findFirst.mockResolvedValue({
        id: 'device-1',
        userId: 'user-1',
      });

      await service.unregister('user-1', 'device-1');

      expect(mockPrisma.userDevice.delete).toHaveBeenCalledWith({
        where: { id: 'device-1' },
      });
    });

    it('throws NotFoundException when device does not exist', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.userDevice.findFirst.mockResolvedValue(null);

      await expect(service.unregister('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.userDevice.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when device belongs to another user', async () => {
      const { service, mockPrisma } = createMocks();
      mockPrisma.userDevice.findFirst.mockResolvedValue(null); // Not found because userId doesn't match

      await expect(service.unregister('user-2', 'device-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('returns all devices for the user ordered by lastSeenAt desc', async () => {
      const { service, mockPrisma } = createMocks();
      const devices = [
        {
          id: 'd1',
          userId: 'user-1',
          deviceType: 'ios',
          deviceToken: 'token-1',
          lastSeenAt: new Date('2024-02-01'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'd2',
          userId: 'user-1',
          deviceType: 'android',
          deviceToken: 'token-2',
          lastSeenAt: new Date('2024-01-15'),
          createdAt: new Date('2024-01-01'),
        },
      ];
      mockPrisma.userDevice.findMany.mockResolvedValue(devices);

      const result = await service.list('user-1');

      // The mock returns the full row; in production Prisma's `select`
      // filters out `deviceToken` server-side. This test verifies the
      // call args (the `select` clause) — the actual filtering is
      // exercised by integration tests against a real DB.
      expect(mockPrisma.userDevice.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { lastSeenAt: 'desc' },
        select: {
          id: true,
          userId: true,
          deviceType: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(devices);
    });
  });
});
