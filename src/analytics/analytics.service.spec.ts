import { AnalyticsService } from './analytics.service';
import { AnalyticsEventType } from './dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      profileView: { create: jest.fn() },
      companyView: { create: jest.fn() },
      postImpression: { create: jest.fn() },
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
      user: { count: jest.fn() },
      post: { count: jest.fn() },
      job: { count: jest.fn() },
      application: { count: jest.fn() },
      report: { count: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    service = new AnalyticsService(prisma);
  });

  describe('recordEvent', () => {
    it('creates ProfileView and increments slotted counter atomically', async () => {
      prisma.profileView.create.mockResolvedValue({ id: 'view-1' });
      prisma.$executeRaw.mockResolvedValue(1);

      await service.recordEvent(
        { eventType: AnalyticsEventType.PROFILE_VIEW, targetId: 'p1' },
        'u1',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.profileView.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          profileId: 'p1',
          userId: 'u1',
          ipHash: expect.any(String),
          userAgent: 'Mozilla/5.0',
        }),
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('creates CompanyView', async () => {
      prisma.companyView.create.mockResolvedValue({ id: 'view-2' });
      prisma.$executeRaw.mockResolvedValue(1);

      await service.recordEvent(
        { eventType: AnalyticsEventType.COMPANY_VIEW, targetId: 'c1' },
        'u1',
        '127.0.0.1',
        'ua',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.companyView.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'c1',
        }),
      });
    });
  });

  describe('getDashboardMetrics', () => {
    it('returns dashboard counts', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.post.count.mockResolvedValue(5);
      prisma.job.count.mockResolvedValue(3);
      prisma.application.count.mockResolvedValue(2);
      prisma.report.count.mockResolvedValue(1);

      const result = await service.getDashboardMetrics();
      expect(result.dailyNewUsers).toBe(10);
      expect(result.dailyNewPosts).toBe(5);
    });
  });

  describe('getEntityAnalytics', () => {
    it('returns total, unique viewer, and date-range counts', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: 10n }])
        .mockResolvedValueOnce([{ count: 3n }])
        .mockResolvedValueOnce([{ count: 4n }])
        .mockResolvedValueOnce([{ count: 8n }]);

      const result = await service.getEntityAnalytics('profile_view', 'p1');

      expect(result).toEqual({
        totalViews: 10,
        uniqueViewers: 3,
        last7Days: 4,
        last30Days: 8,
      });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
      const queryCalls = prisma.$queryRaw.mock.calls as Array<
        [TemplateStringsArray]
      >;
      const queries = queryCalls.map(([strings]) => String.raw(strings));
      expect(queries[1]).toContain('COUNT(DISTINCT user_id)');
      expect(queries[1]).toContain('created_at >=');
      expect(queries[2]).toContain('created_at >=');
      expect(queries[3]).toContain('created_at >=');
    });
  });
});
