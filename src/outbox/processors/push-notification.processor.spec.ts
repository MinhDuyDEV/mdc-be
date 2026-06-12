import { PinoLogger } from 'nestjs-pino';
import { PushNotificationProcessor } from './push-notification.processor';

const noopLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
} as unknown as PinoLogger;

describe('PushNotificationProcessor', () => {
  function createMocks(prefs: Record<string, unknown> | null = null) {
    const mockPrisma = {
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(prefs),
      },
    };

    const mockPushService = {
      sendPush: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    };

    const processor = new PushNotificationProcessor(
      mockPrisma as never,
      mockPushService as never,
      noopLogger,
    );

    return { processor, mockPrisma, mockPushService };
  }

  const basePayload = {
    userId: 'user-1',
    type: 'new_message',
    title: 'John Doe',
    body: 'Hey, how are you?',
    data: { conversationId: 'conv-1' },
  };

  describe('process', () => {
    it('sends push when preferences do not exist (default enabled)', async () => {
      const { processor, mockPushService } = createMocks(null);

      await processor.process(basePayload);

      expect(mockPushService.sendPush).toHaveBeenCalledWith('user-1', {
        title: 'John Doe',
        body: 'Hey, how are you?',
        data: { conversationId: 'conv-1' },
      });
    });

    it('sends push when all preferences are enabled', async () => {
      const { processor, mockPushService } = createMocks({
        pushEnabled: true,
        newMessage: true,
        connectionRequest: true,
        connectionAccepted: true,
        applicationStatusChange: true,
        jobRecommendation: true,
        postInteraction: true,
      });

      await processor.process(basePayload);

      expect(mockPushService.sendPush).toHaveBeenCalledWith('user-1', {
        title: 'John Doe',
        body: 'Hey, how are you?',
        data: { conversationId: 'conv-1' },
      });
    });

    it('skips push when the specific type preference is disabled', async () => {
      const { processor, mockPushService } = createMocks({
        newMessage: false,
        connectionRequest: true,
        connectionAccepted: true,
        applicationStatusChange: true,
        jobRecommendation: true,
        postInteraction: true,
      });

      await processor.process(basePayload);

      expect(mockPushService.sendPush).not.toHaveBeenCalled();
    });

    it('maps connection_request type to connectionRequest preference', async () => {
      const { processor, mockPushService } = createMocks({
        pushEnabled: true,
        newMessage: true,
        connectionRequest: true,
      });

      await processor.process({
        ...basePayload,
        type: 'connection_request',
        body: 'wants to connect with you',
      });

      expect(mockPushService.sendPush).toHaveBeenCalled();
    });

    it('maps connection_accepted type to connectionAccepted preference', async () => {
      const { processor, mockPushService } = createMocks({
        pushEnabled: true,
        connectionAccepted: true,
      });

      await processor.process({
        ...basePayload,
        type: 'connection_accepted',
      });

      expect(mockPushService.sendPush).toHaveBeenCalled();
    });

    it('maps application_status_change type correctly', async () => {
      const { processor, mockPushService } = createMocks({
        pushEnabled: true,
        applicationStatusChange: true,
      });

      await processor.process({
        ...basePayload,
        type: 'application_status_change',
      });

      expect(mockPushService.sendPush).toHaveBeenCalled();
    });

    it('maps job_recommendation type correctly', async () => {
      const { processor, mockPushService } = createMocks({
        pushEnabled: true,
        jobRecommendation: true,
      });

      await processor.process({
        ...basePayload,
        type: 'job_recommendation',
      });

      expect(mockPushService.sendPush).toHaveBeenCalled();
    });

    it('sends push for unknown notification types when pushEnabled is true', async () => {
      const { processor, mockPushService } = createMocks({
        pushEnabled: true,
      });

      await processor.process({
        ...basePayload,
        type: 'unknown_type',
      });

      expect(mockPushService.sendPush).toHaveBeenCalled();
    });
  });
});
