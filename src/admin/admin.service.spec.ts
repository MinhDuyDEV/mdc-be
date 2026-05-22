import { UserStatus } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), update: jest.fn() },
      company: { findMany: jest.fn(), update: jest.fn() },
      companyVerification: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      job: { findMany: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    service = new AdminService(prisma);
  });

  describe('listUsers', () => {
    it('returns paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'test@example.com' },
      ]);
      const result = await service.listUsers({});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('updateUserStatus', () => {
    it('suspends user and revokes sessions', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.SUSPENDED,
      });
      await service.updateUserStatus(
        'user-1',
        { status: UserStatus.SUSPENDED, reason: 'Spam' },
        'admin-1',
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
