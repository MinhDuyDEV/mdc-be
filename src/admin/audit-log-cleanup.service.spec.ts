import { AuditLogCleanupService } from "./audit-log-cleanup.service";

describe("AuditLogCleanupService", () => {
  let service: AuditLogCleanupService;
  let prisma: { auditLog: { deleteMany: jest.Mock; count: jest.Mock } };
  let leaderLock: { runIfLeader: jest.Mock };

  beforeEach(() => {
    prisma = {
      auditLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 7 }),
        count: jest.fn().mockResolvedValue(7),
      },
    };
    leaderLock = {
      runIfLeader: jest
        .fn()
        .mockImplementation(async (_name: string, _ttl: number, work: () => Promise<void>) => {
          await work();
          return true;
        }),
    };
    service = new AuditLogCleanupService(prisma as never, leaderLock as never);
  });

  it("delegates to leader lock with the audit-log-cleanup name", async () => {
    await service.purge();
    expect(leaderLock.runIfLeader).toHaveBeenCalledWith(
      "audit-log-cleanup",
      300_000,
      expect.any(Function),
    );
  });

  it("deletes audit log rows older than the configured retention", async () => {
    const before = new Date("2026-01-01T00:00:00Z");
    jest.useFakeTimers().setSystemTime(new Date("2026-06-13T00:00:00Z"));

    await service.purge();

    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(1);
    const args = prisma.auditLog.deleteMany.mock.calls[0][0];
    expect(args.where.createdAt.lt).toBeInstanceOf(Date);
    // 90 days back from 2026-06-13 = 2026-03-15.
    const expectedCutoff = new Date("2026-03-15T00:00:00Z");
    const actual = args.where.createdAt.lt as Date;
    // Allow ±1 minute for time-of-day.
    expect(Math.abs(actual.getTime() - expectedCutoff.getTime())).toBeLessThan(60_000);

    jest.useRealTimers();
    void before;
  });

  it("does not throw when the leader lock denies the work", async () => {
    leaderLock.runIfLeader.mockResolvedValueOnce(false);
    await expect(service.purge()).resolves.toBeUndefined();
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });
});
