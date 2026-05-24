import { BadRequestException, ForbiddenException } from '@nestjs/common';

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
        update: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn() },
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
});
