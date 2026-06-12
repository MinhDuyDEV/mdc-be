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
      application: { count: jest.fn(), groupBy: jest.fn() },
      report: { count: jest.fn() },
      company: { count: jest.fn() },
      connection: { count: jest.fn() },
      message: { count: jest.fn() },
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
    it('returns dashboard counts with enriched metrics', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.post.count.mockResolvedValue(5);
      prisma.job.count
        .mockResolvedValueOnce(3) // daily new jobs
        .mockResolvedValueOnce(50); // totalActiveJobs
      prisma.application.count.mockResolvedValue(2);
      prisma.report.count.mockResolvedValue(1);
      prisma.company.count.mockResolvedValue(20);
      prisma.connection.count.mockResolvedValue(200);
      prisma.message.count
        .mockResolvedValueOnce(15) // 24h
        .mockResolvedValueOnce(75) // 7d
        .mockResolvedValueOnce(300); // 30d

      const result = await service.getDashboardMetrics();
      expect(result.dailyNewUsers).toBe(10);
      expect(result.dailyNewPosts).toBe(5);
      expect(result.dailyNewJobs).toBe(3);
      expect(result.dailyApplications).toBe(2);
      expect(result.dailyReports).toBe(1);
      expect(result.totalActiveJobs).toBe(50);
      expect(result.totalCompanies).toBe(20);
      expect(result.totalConnections).toBe(200);
      expect(result.messageVolume24h).toBe(15);
      expect(result.messageVolume7d).toBe(75);
      expect(result.messageVolume30d).toBe(300);
    });
  });

  describe('getRecruitingMetrics', () => {
    it('returns pipeline, transition times, and conversion rates', async () => {
      prisma.application.groupBy.mockResolvedValue([
        { status: 'SUBMITTED', _count: { id: 100 } },
        { status: 'REVIEWED', _count: { id: 40 } },
        { status: 'INTERVIEWING', _count: { id: 20 } },
        { status: 'OFFER', _count: { id: 10 } },
        { status: 'ACCEPTED', _count: { id: 5 } },
        { status: 'REJECTED', _count: { id: 30 } },
        { status: 'WITHDRAWN', _count: { id: 5 } },
      ]);

      // avgTransitionTimes
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            from_status: 'SUBMITTED',
            to_status: 'REVIEWED',
            avg_hours: 48n,
            count: 60n,
          },
          {
            from_status: 'REVIEWED',
            to_status: 'INTERVIEWING',
            avg_hours: 72n,
            count: 30n,
          },
          {
            from_status: 'INTERVIEWING',
            to_status: 'OFFER',
            avg_hours: 120n,
            count: 15n,
          },
          {
            from_status: 'OFFER',
            to_status: 'ACCEPTED',
            avg_hours: 48n,
            count: 8n,
          },
        ])
        // transitionCounts (distinct apps per transition)
        .mockResolvedValueOnce([
          { from_status: 'SUBMITTED', to_status: 'REVIEWED', count: 60n },
          { from_status: 'REVIEWED', to_status: 'INTERVIEWING', count: 30n },
          { from_status: 'INTERVIEWING', to_status: 'OFFER', count: 15n },
          { from_status: 'OFFER', to_status: 'ACCEPTED', count: 8n },
        ])
        // statusReachRaw (distinct apps per status)
        .mockResolvedValueOnce([
          { to_status: 'REVIEWED', count: 65n },
          { to_status: 'INTERVIEWING', count: 32n },
          { to_status: 'OFFER', count: 15n },
          { to_status: 'ACCEPTED', count: 8n },
          { to_status: 'REJECTED', count: 20n },
        ]);

      const result = await service.getRecruitingMetrics();

      // Pipeline counts
      expect(result.pipelineCounts).toHaveLength(7);
      expect(
        result.pipelineCounts.find((p) => p.status === 'SUBMITTED')?.count,
      ).toBe(100);
      expect(
        result.pipelineCounts.find((p) => p.status === 'ACCEPTED')?.count,
      ).toBe(5);

      // Transition times
      expect(result.avgTransitionTimes).toHaveLength(4);
      expect(result.avgTransitionTimes[0]).toEqual({
        fromStatus: 'SUBMITTED',
        toStatus: 'REVIEWED',
        avgHours: 48,
        count: 60,
      });

      // Conversion rates
      expect(result.conversionRates).toHaveLength(4);
      const submittedToReviewed = result.conversionRates.find(
        (c) => c.fromStatus === 'SUBMITTED' && c.toStatus === 'REVIEWED',
      )!;
      expect(submittedToReviewed.rate).toBeCloseTo(60 / 210, 2); // 60 / totalApps(210)
      expect(submittedToReviewed.fromCount).toBe(210);
      expect(submittedToReviewed.transitionCount).toBe(60);
    });
  });

  describe('getEntityAnalytics', () => {
    it('returns total, unique viewer, and date-range counts', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: 10n }])
        .mockResolvedValueOnce([{ count: 3n }])
        .mockResolvedValueOnce([{ count: 4n }])
        .mockResolvedValueOnce([{ count: 8n }]);

      const result = await service.getEntityAnalytics(
        AnalyticsEventType.PROFILE_VIEW,
        'p1',
      );

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
