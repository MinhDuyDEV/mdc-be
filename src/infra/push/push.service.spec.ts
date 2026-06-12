import { PinoLogger } from 'nestjs-pino';
import { PushService } from './push.service';

const noopLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
} as unknown as PinoLogger;

describe('PushService', () => {
  function createMocks() {
    const mockPrisma = {
      userDevice: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockFcmService = {
      isEnabled: true,
      sendMulticast: jest.fn(),
    };

    const mockApnsService = {
      isEnabled: true,
      send: jest.fn(),
    };

    const pushService = new PushService(
      mockPrisma as never,
      mockFcmService as never,
      mockApnsService as never,
      noopLogger,
    );

    return { pushService, mockPrisma, mockFcmService, mockApnsService };
  }

  describe('sendPush', () => {
    it('returns { sent: 0, failed: 0 } when user has no devices', async () => {
      const { pushService, mockPrisma } = createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([]);

      const result = await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toEqual({ sent: 0, failed: 0 });
    });

    it('sends via FCM for Android devices', async () => {
      const { pushService, mockPrisma, mockFcmService } = createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd1',
          userId: 'user-1',
          deviceType: 'android',
          deviceToken: 'token-1',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      mockFcmService.sendMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, error: undefined, messageId: 'm1' }],
      });

      const result = await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
        data: { key: 'value' },
      });
      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(mockFcmService.sendMulticast).toHaveBeenCalledWith(
        ['token-1'],
        { title: 'Test', body: 'Test body' },
        { key: 'value' },
      );
    });

    it('sends via APNs for iOS devices', async () => {
      const { pushService, mockPrisma, mockApnsService } = createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd2',
          userId: 'user-1',
          deviceType: 'ios',
          deviceToken: 'ios-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      mockApnsService.send.mockResolvedValue({ success: true });

      const result = await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(mockApnsService.send).toHaveBeenCalledWith(
        'ios-token',
        { title: 'Test', body: 'Test body' },
        undefined,
      );
    });

    it('sends via FCM for web devices', async () => {
      const { pushService, mockPrisma, mockFcmService } = createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd3',
          userId: 'user-1',
          deviceType: 'web',
          deviceToken: 'web-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      mockFcmService.sendMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, error: undefined, messageId: 'm1' }],
      });

      const result = await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toEqual({ sent: 1, failed: 0 });
    });

    it('skips FCM when FcmService is disabled', async () => {
      const { pushService, mockPrisma, mockFcmService } = createMocks();
      mockFcmService.isEnabled = false;
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd1',
          userId: 'user-1',
          deviceType: 'android',
          deviceToken: 'token-1',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      const result = await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockFcmService.sendMulticast).not.toHaveBeenCalled();
    });

    it('skips APNs when ApnsService is disabled', async () => {
      const { pushService, mockPrisma, mockApnsService } = createMocks();
      mockApnsService.isEnabled = false;
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd2',
          userId: 'user-1',
          deviceType: 'ios',
          deviceToken: 'ios-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      const result = await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockApnsService.send).not.toHaveBeenCalled();
    });

    it('cleans up invalid FCM tokens', async () => {
      const { pushService, mockPrisma, mockFcmService } = createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd1',
          userId: 'user-1',
          deviceType: 'android',
          deviceToken: 'invalid-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      mockFcmService.sendMulticast.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: { code: 'messaging/invalid-registration-token' },
            messageId: undefined,
          },
        ],
      });

      await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(mockPrisma.userDevice.updateMany).toHaveBeenCalledWith({
        where: { deviceToken: { in: ['invalid-token'] } },
        data: { deviceToken: null },
      });
    });

    it('cleans up invalid APNs tokens (BadDeviceToken)', async () => {
      const { pushService, mockPrisma, mockApnsService } = createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd2',
          userId: 'user-1',
          deviceType: 'ios',
          deviceToken: 'bad-ios-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      mockApnsService.send.mockResolvedValue({
        success: false,
        reason: 'BadDeviceToken',
        statusCode: 410,
      });

      await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(mockPrisma.userDevice.updateMany).toHaveBeenCalledWith({
        where: { deviceToken: { in: ['bad-ios-token'] } },
        data: { deviceToken: null },
      });
    });

    it('cleans up invalid APNs tokens (410 status code)', async () => {
      const { pushService, mockPrisma, mockApnsService } = createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd2',
          userId: 'user-1',
          deviceType: 'ios',
          deviceToken: 'expired-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      mockApnsService.send.mockResolvedValue({
        success: false,
        reason: 'Unregistered',
        statusCode: 410,
      });

      await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(mockPrisma.userDevice.updateMany).toHaveBeenCalledWith({
        where: { deviceToken: { in: ['expired-token'] } },
        data: { deviceToken: null },
      });
    });

    it('handles mixed Android and iOS devices', async () => {
      const { pushService, mockPrisma, mockFcmService, mockApnsService } =
        createMocks();
      mockPrisma.userDevice.findMany.mockResolvedValue([
        {
          id: 'd1',
          userId: 'user-1',
          deviceType: 'android',
          deviceToken: 'android-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'd2',
          userId: 'user-1',
          deviceType: 'ios',
          deviceToken: 'ios-token',
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      mockFcmService.sendMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, error: undefined, messageId: 'm1' }],
      });
      mockApnsService.send.mockResolvedValue({ success: true });

      const result = await pushService.sendPush('user-1', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toEqual({ sent: 2, failed: 0 });
    });
  });
});
