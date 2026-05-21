import { MessagingProcessor } from './messaging.processor';

describe('MessagingProcessor', () => {
  let processor: MessagingProcessor;
  let prisma: any;
  let idempotency: any;

  beforeEach(() => {
    prisma = {
      message: { findUnique: jest.fn() },
      notification: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    idempotency = { claim: jest.fn().mockResolvedValue({}) };
    const chatGateway = { pushMessage: jest.fn() } as any;
    const realtimeGateway = { pushNotification: jest.fn() } as any;
    processor = new MessagingProcessor(
      prisma,
      idempotency,
      chatGateway,
      realtimeGateway,
    );
  });

  it('creates NewMessage notifications for all recipients except sender', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'msg-1',
      content: 'Hello',
      senderId: 'user-1',
      createdAt: new Date(),
    });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      createdAt: new Date(),
    });

    await processor.processMessageSent({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      recipientIds: ['user-1', 'user-2', 'user-3'],
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-2',
          type: 'NewMessage',
        }),
      }),
    );
  });

  it('skips notification creation if message not found', async () => {
    prisma.message.findUnique.mockResolvedValue(null);

    await processor.processMessageSent({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      recipientIds: ['user-2'],
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('skips duplicate notifications', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'msg-1',
      content: 'Hello',
      senderId: 'user-1',
      createdAt: new Date(),
    });
    prisma.notification.findFirst
      .mockResolvedValueOnce({ id: 'existing-notif' }) // user-2 has existing
      .mockResolvedValue(null); // user-3 has none
    prisma.notification.create.mockResolvedValue({
      id: 'notif-new',
      createdAt: new Date(),
    });

    await processor.processMessageSent({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      recipientIds: ['user-2', 'user-3'],
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-3' }),
      }),
    );
  });
});
