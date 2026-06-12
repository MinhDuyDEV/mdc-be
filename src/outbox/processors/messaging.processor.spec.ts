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
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    idempotency = { claim: jest.fn().mockResolvedValue({}) };
    const chatGateway = {
      pushMessage: jest.fn(),
      pushMessageEdited: jest.fn(),
      pushMessageDeleted: jest.fn(),
    } as any;
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
    // Verify search index was populated
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO conversation_search_index'),
      'conv-1',
      'msg-1',
      'Hello',
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
    // Search index should not be populated when message not found
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
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

  it('processMessageEdited updates search index and pushes realtime event', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'msg-1',
      content: 'Updated content',
    });

    await processor.processMessageEdited({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      editorId: 'user-1',
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO conversation_search_index'),
      'conv-1',
      'msg-1',
      'Updated content',
    );
    expect(processor['chatGateway'].pushMessageEdited).toHaveBeenCalledWith(
      'conv-1',
      'msg-1',
      'user-1',
    );
  });

  it('processMessageDeleted removes search index and pushes realtime event', async () => {
    await processor.processMessageDeleted({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      deleterId: 'user-1',
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM conversation_search_index'),
      'msg-1',
    );
    expect(processor['chatGateway'].pushMessageDeleted).toHaveBeenCalledWith(
      'conv-1',
      'msg-1',
      'user-1',
    );
  });
});
