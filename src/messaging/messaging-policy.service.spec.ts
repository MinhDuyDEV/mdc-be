import type { PrismaService } from '../infra/prisma/prisma.service';
import { MessagingPolicyService } from './messaging-policy.service';

describe('MessagingPolicyService', () => {
  let prisma: any;
  let service: MessagingPolicyService;

  beforeEach(() => {
    prisma = {
      conversationParticipant: {
        findFirst: jest.fn(),
      },
      block: {
        findFirst: jest.fn(),
      },
    };
    service = new MessagingPolicyService(prisma as PrismaService);
  });

  describe('isActiveParticipant', () => {
    it('returns true when user is active participant', async () => {
      prisma.conversationParticipant.findFirst.mockResolvedValue({
        id: 'participant-1',
      });
      const result = await service.isActiveParticipant('user-1', 'conv-1');
      expect(result).toBe(true);
    });

    it('returns false when user is not participant', async () => {
      prisma.conversationParticipant.findFirst.mockResolvedValue(null);
      const result = await service.isActiveParticipant('user-1', 'conv-1');
      expect(result).toBe(false);
    });

    it('returns false when user has left conversation', async () => {
      prisma.conversationParticipant.findFirst.mockResolvedValue(null);
      const result = await service.isActiveParticipant('user-1', 'conv-1');
      expect(result).toBe(false);
    });
  });

  describe('canCreateConversation', () => {
    it('returns true when users are not blocked', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      const result = await service.canCreateConversation('user-1', 'user-2');
      expect(result).toBe(true);
    });

    it('returns false when either user blocked the other', async () => {
      prisma.block.findFirst.mockResolvedValue({ id: 'block-1' });
      const result = await service.canCreateConversation('user-1', 'user-2');
      expect(result).toBe(false);
    });
  });
});
