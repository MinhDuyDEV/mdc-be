import { MediaCleanupService } from './media-cleanup.service';

describe('MediaCleanupService', () => {
  function createService() {
    const prisma = {
      mediaAsset: {
        updateMany: jest.fn(),
      },
    };
    const leaderLock = {
      runIfLeader: jest.fn(
        async (
          _lockName: string,
          _ttlMs: number,
          work: () => Promise<void>,
        ) => {
          await work();
          return true;
        },
      ),
    };

    return {
      leaderLock,
      prisma,
      service: new MediaCleanupService(prisma as any, leaderLock as any),
    };
  }

  it('marks expired pending media as deleted when leader lock is acquired', async () => {
    const { leaderLock, prisma, service } = createService();
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 2 });

    await service.cleanup();

    expect(leaderLock.runIfLeader).toHaveBeenCalledWith(
      'media-cleanup',
      50000,
      expect.any(Function),
    );
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        createdAt: { lt: expect.any(Date) },
      },
      data: { status: 'DELETED' },
    });
  });

  it('skips cleanup when another worker holds the leader lock', async () => {
    const { leaderLock, prisma, service } = createService();
    leaderLock.runIfLeader.mockResolvedValue(false);

    await service.cleanup();

    expect(prisma.mediaAsset.updateMany).not.toHaveBeenCalled();
  });
});
