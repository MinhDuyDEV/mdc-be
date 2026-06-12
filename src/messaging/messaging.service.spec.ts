import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  let prisma: any;
  let outbox: any;
  let idempotency: any;
  let messagingPolicy: any;
  let recruitingPolicy: any;
  let service: MessagingService;

  beforeEach(() => {
    prisma = {
      conversation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      conversationParticipant: {
        createMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { emit: jest.fn() };
    idempotency = { claim: jest.fn().mockResolvedValue({}) };
    messagingPolicy = {
      isActiveParticipant: jest.fn().mockResolvedValue(true),
      canCreateConversation: jest.fn().mockResolvedValue(true),
      canSendMessage: jest.fn().mockResolvedValue(true),
    };
    recruitingPolicy = {
      canMessageCandidate: jest
        .fn()
        .mockResolvedValue({ allowed: true, reason: 'OPT_IN' }),
    };
    service = new MessagingService(
      prisma,
      outbox,
      idempotency,
      messagingPolicy,
      recruitingPolicy,
    );
  });

  describe('createConversation', () => {
    it('rejects self-conversation with SELF_CONVERSATION', async () => {
      await expect(
        service.createConversation('user-1', { participantIds: ['user-1'] }),
      ).rejects.toThrow(new BadRequestException('SELF_CONVERSATION'));
    });

    it('rejects blocked users with BLOCKED_USER', async () => {
      messagingPolicy.canCreateConversation.mockResolvedValue(false);
      await expect(
        service.createConversation('user-1', { participantIds: ['user-2'] }),
      ).rejects.toThrow(new BadRequestException('BLOCKED_USER'));
    });

    it('returns existing conversation if already exists', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      const result = await service.createConversation('user-1', {
        participantIds: ['user-2'],
      });
      expect(result.id).toBe('conv-1');
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates new conversation and emits ConversationCreated event', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue({
        id: 'conv-1',
        type: 'DIRECT',
      });
      await service.createConversation('user-1', {
        participantIds: ['user-2'],
      });
      expect(prisma.conversation.create).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'ConversationCreated' }),
      );
    });
  });

  describe('createRecruitingConversation', () => {
    it('rejects self-conversation', async () => {
      await expect(
        service.createRecruitingConversation('user-1', {
          candidateUserId: 'user-1',
        }),
      ).rejects.toThrow(new BadRequestException('SELF_CONVERSATION'));
    });

    it('rejects when not authorized by recruiting policy', async () => {
      recruitingPolicy.canMessageCandidate.mockResolvedValue({
        allowed: false,
        reason: 'NO_RECRUITING_AUTHORIZATION',
      });
      await expect(
        service.createRecruitingConversation('recruiter-1', {
          candidateUserId: 'user-2',
        }),
      ).rejects.toThrow(new ForbiddenException('NO_RECRUITING_AUTHORIZATION'));
    });

    it('creates recruiting conversation when authorized', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue({
        id: 'conv-recr-1',
        type: 'DIRECT',
      });
      await service.createRecruitingConversation('recruiter-1', {
        candidateUserId: 'user-2',
      });
      expect(prisma.conversation.create).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'ConversationCreated' }),
      );
    });
  });

  describe('sendMessage', () => {
    it('rejects non-participants with FORBIDDEN', async () => {
      messagingPolicy.isActiveParticipant.mockResolvedValue(false);
      await expect(
        service.sendMessage('user-1', 'conv-1', { content: 'Hello' }),
      ).rejects.toThrow(new ForbiddenException('NOT_A_PARTICIPANT'));
    });

    it('rejects blocked users with BLOCKED_USER', async () => {
      messagingPolicy.canSendMessage.mockResolvedValue(false);
      await expect(
        service.sendMessage('user-1', 'conv-1', { content: 'Hello' }),
      ).rejects.toThrow(new ForbiddenException('BLOCKED_USER'));
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('creates message and emits MessageSent event', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
      });
      prisma.message.create.mockResolvedValue({
        id: 'msg-1',
        content: 'Hello',
        createdAt: new Date(),
      });
      prisma.conversation.updateMany.mockResolvedValue({ count: 1 });

      await service.sendMessage('user-1', 'conv-1', { content: 'Hello' });

      expect(prisma.message.create).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'MessageSent' }),
      );
    });

    it('does not overwrite lastMessageAt with older messages (monotonic guard)', async () => {
      const olderDate = new Date('2026-01-01T00:00:00.000Z');

      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
      });

      prisma.message.create.mockResolvedValue({
        id: 'msg-older',
        content: 'Older message',
        createdAt: olderDate,
      });

      await service.sendMessage('user-1', 'conv-1', { content: 'Hello' });

      // Verify updateMany was called with the monotonic OR guard
      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'conv-1',
          OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: olderDate } }],
        },
        data: {
          lastMessageAt: olderDate,
          lastMessagePreview: 'Hello',
        },
      });

      // update should NOT be called for conversation denorm
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe('listConversations', () => {
    it('returns paginated conversations', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          lastMessageAt: new Date(),
          createdAt: new Date(),
          participants: [],
        },
      ]);
      const result = await service.listConversations('user-1', {
        limit: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toBeDefined();
    });

    it('defaults missing limit before calling Prisma', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);

      const result = await service.listConversations(
        'user-1',
        {} as CursorPaginationQueryDto,
      );

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 }),
      );
      expect(result.meta.limit).toBe(20);
    });
  });

  describe('getMessages', () => {
    it('defaults missing limit before calling Prisma', async () => {
      prisma.message.findMany.mockResolvedValue([]);

      const result = await service.getMessages(
        'user-1',
        'conv-1',
        {} as CursorPaginationQueryDto,
      );

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 }),
      );
      expect(result.meta.limit).toBe(20);
    });
  });

  describe('markRead', () => {
    it('updates lastReadAt for participant', async () => {
      prisma.conversationParticipant.update.mockResolvedValue({});
      const result = await service.markRead('user-1', 'conv-1');
      expect(result).toEqual({ ok: true });
      expect(prisma.conversationParticipant.update).toHaveBeenCalled();
    });
  });

  describe('createGroupConversation', () => {
    it('creates group conversation with correct participants and emits event', async () => {
      const dto = { title: 'Group Chat', participantIds: ['user-2', 'user-3'] };
      const mockConv = {
        id: 'conv-g1',
        type: 'GROUP',
        title: 'Group Chat',
        participants: [],
      };
      prisma.conversation.create.mockResolvedValue(mockConv);

      const result = await service.createGroupConversation('user-1', dto);

      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'GROUP',
            title: 'Group Chat',
            participants: {
              createMany: {
                data: [
                  { userId: 'user-1', role: 'ADMIN' },
                  { userId: 'user-2', role: 'MEMBER' },
                  { userId: 'user-3', role: 'MEMBER' },
                ],
              },
            },
          }),
        }),
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'ConversationCreated' }),
      );
      expect(result).toBe(mockConv);
    });
  });

  describe('updateGroupConversation', () => {
    it('updates title for admin', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
        role: 'ADMIN',
      });
      prisma.conversation.update.mockResolvedValue({
        id: 'conv-g1',
        title: 'New Title',
      });

      const result = await service.updateGroupConversation(
        'user-1',
        'conv-g1',
        {
          title: 'New Title',
        },
      );

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-g1' },
        data: { title: 'New Title' },
      });
      expect(result.title).toBe('New Title');
    });

    it('rejects non-admin with NOT_ADMIN', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-2',
        role: 'MEMBER',
      });

      await expect(
        service.updateGroupConversation('user-2', 'conv-g1', {
          title: 'New Title',
        }),
      ).rejects.toThrow(new ForbiddenException('NOT_ADMIN'));
    });

    it('rejects when participant not found', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateGroupConversation('user-2', 'conv-g1', {
          title: 'New Title',
        }),
      ).rejects.toThrow(new ForbiddenException('NOT_ADMIN'));
    });
  });

  describe('addParticipant', () => {
    it('adds participant with MEMBER role', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
        role: 'ADMIN',
      });
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-g1',
        type: 'GROUP',
      });
      const newParticipant = {
        conversationId: 'conv-g1',
        userId: 'user-4',
        role: 'MEMBER',
      };
      prisma.conversationParticipant.create.mockResolvedValue(newParticipant);

      const result = await service.addParticipant(
        'user-1',
        'conv-g1',
        'user-4',
      );

      expect(prisma.conversationParticipant.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-g1',
          userId: 'user-4',
          role: 'MEMBER',
        },
      });
      expect(result).toEqual(newParticipant);
    });

    it('rejects non-admin with NOT_ADMIN', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-2',
        role: 'MEMBER',
      });

      await expect(
        service.addParticipant('user-2', 'conv-g1', 'user-4'),
      ).rejects.toThrow(new ForbiddenException('NOT_ADMIN'));
    });

    it('rejects non-group conversation with NOT_A_GROUP_CONVERSATION', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
        role: 'ADMIN',
      });
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-d1',
        type: 'DIRECT',
      });

      await expect(
        service.addParticipant('user-1', 'conv-d1', 'user-4'),
      ).rejects.toThrow(new BadRequestException('NOT_A_GROUP_CONVERSATION'));
    });
  });

  describe('removeParticipant', () => {
    it('self-leave sets leftAt and returns ok', async () => {
      const result = await service.removeParticipant(
        'user-1',
        'conv-g1',
        'user-1',
      );

      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
        where: {
          conversationId_userId: {
            conversationId: 'conv-g1',
            userId: 'user-1',
          },
        },
        data: { leftAt: expect.any(Date) },
      });
      expect(result).toEqual({ ok: true });
    });

    it('admin removes other participant and returns ok', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
        role: 'ADMIN',
      });

      const result = await service.removeParticipant(
        'user-1',
        'conv-g1',
        'user-2',
      );

      expect(prisma.conversationParticipant.delete).toHaveBeenCalledWith({
        where: {
          conversationId_userId: {
            conversationId: 'conv-g1',
            userId: 'user-2',
          },
        },
      });
      expect(result).toEqual({ ok: true });
    });

    it('rejects non-admin removing other with NOT_ADMIN', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-2',
        role: 'MEMBER',
      });

      await expect(
        service.removeParticipant('user-2', 'conv-g1', 'user-3'),
      ).rejects.toThrow(new ForbiddenException('NOT_ADMIN'));
    });
  });

  describe('editMessage', () => {
    const existingMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: 'Original content',
    };

    it('edits message content, sets editedAt, and emits MessageEdited event', async () => {
      prisma.message.findUnique.mockResolvedValue(existingMessage);
      prisma.message.update.mockResolvedValue({
        ...existingMessage,
        content: 'Updated',
        editedAt: new Date(),
      });

      const result = await service.editMessage('user-1', 'conv-1', 'msg-1', {
        content: 'Updated',
      });

      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          content: 'Updated',
          editedAt: expect.any(Date),
        }),
      });
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'MessageEdited' }),
      );
      expect(result.content).toBe('Updated');
    });

    it('rejects non-sender with NOT_MESSAGE_SENDER', async () => {
      prisma.message.findUnique.mockResolvedValue(existingMessage);

      await expect(
        service.editMessage('user-2', 'conv-1', 'msg-1', {
          content: 'Updated',
        }),
      ).rejects.toThrow(new ForbiddenException('NOT_MESSAGE_SENDER'));
    });

    it('rejects message in wrong conversation with MESSAGE_NOT_FOUND', async () => {
      prisma.message.findUnique.mockResolvedValue(existingMessage);

      await expect(
        service.editMessage('user-1', 'conv-2', 'msg-1', {
          content: 'Updated',
        }),
      ).rejects.toThrow(new NotFoundException('MESSAGE_NOT_FOUND'));
    });

    it('rejects non-existent message with MESSAGE_NOT_FOUND', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      await expect(
        service.editMessage('user-1', 'conv-1', 'msg-999', {
          content: 'Updated',
        }),
      ).rejects.toThrow(new NotFoundException('MESSAGE_NOT_FOUND'));
    });
  });

  describe('deleteMessage', () => {
    const existingMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: 'To delete',
    };

    it('sender can delete their own message', async () => {
      prisma.message.findUnique.mockResolvedValue(existingMessage);

      const result = await service.deleteMessage('user-1', 'conv-1', 'msg-1');

      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'MessageDeleted' }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('admin can delete another users message', async () => {
      prisma.message.findUnique.mockResolvedValue({
        ...existingMessage,
        senderId: 'user-2',
      });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
        role: 'ADMIN',
      });

      const result = await service.deleteMessage('user-1', 'conv-1', 'msg-1');

      expect(prisma.message.update).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: 'MessageDeleted' }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('rejects unauthorized user with NOT_AUTHORIZED', async () => {
      prisma.message.findUnique.mockResolvedValue({
        ...existingMessage,
        senderId: 'user-2',
      });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-3',
        role: 'MEMBER',
      });

      await expect(
        service.deleteMessage('user-3', 'conv-1', 'msg-1'),
      ).rejects.toThrow(new ForbiddenException('NOT_AUTHORIZED'));
    });

    it('rejects non-existent message with MESSAGE_NOT_FOUND', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteMessage('user-1', 'conv-1', 'msg-999'),
      ).rejects.toThrow(new NotFoundException('MESSAGE_NOT_FOUND'));
    });

    it('rejects message in wrong conversation with MESSAGE_NOT_FOUND', async () => {
      prisma.message.findUnique.mockResolvedValue(existingMessage);

      await expect(
        service.deleteMessage('user-1', 'conv-2', 'msg-1'),
      ).rejects.toThrow(new NotFoundException('MESSAGE_NOT_FOUND'));
    });
  });

  describe('searchMessages', () => {
    it('returns paginated results', async () => {
      const rows = [
        {
          id: 'idx-1',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          created_at: new Date('2026-01-01'),
          content: 'Hello world',
          sender_id: 'user-2',
          message_created_at: new Date('2026-01-01'),
        },
      ];
      prisma.$queryRawUnsafe.mockResolvedValue(rows);

      const result = await service.searchMessages('user-1', {
        q: 'hello',
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].content).toBe('Hello world');
      expect(result.data[0].messageId).toBe('msg-1');
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('returns empty array for empty query string', async () => {
      const result = await service.searchMessages('user-1', {
        q: '',
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('returns empty array for whitespace-only query', async () => {
      const result = await service.searchMessages('user-1', {
        q: '   ',
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('sanitizes input by stripping special characters', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.searchMessages('user-1', {
        q: 'hello; DROP TABLE users; --',
        limit: 20,
      });

      const sql = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('hello');
      // DROP passes through (word chars only — regex keeps \w\s-)
      expect(sql).not.toContain(';');
    });

    it('paginates with limit and returns cursor', async () => {
      const rows = [
        {
          id: 'idx-2',
          conversation_id: 'conv-1',
          message_id: 'msg-2',
          created_at: new Date('2026-01-02'),
          content: 'Second',
          sender_id: 'user-2',
          message_created_at: new Date('2026-01-02'),
        },
        {
          id: 'idx-1',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          created_at: new Date('2026-01-01'),
          content: 'First',
          sender_id: 'user-2',
          message_created_at: new Date('2026-01-01'),
        },
      ];
      prisma.$queryRawUnsafe.mockResolvedValue(rows);

      const result = await service.searchMessages('user-1', {
        q: 'hello',
        limit: 1,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
    });

    it('filters by conversationId when provided', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.searchMessages('user-1', {
        q: 'hello',
        limit: 20,
        conversationId: 'conv-1',
      });

      const sql = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
      expect(sql).toContain("conversation_id = 'conv-1'::uuid");
    });
  });
});
