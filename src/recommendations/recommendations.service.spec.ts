import type { Redis } from 'ioredis';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { RecommendationsRepository } from './recommendations.repository';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let prisma: {
    user: { findMany: jest.Mock };
    job: { findMany: jest.Mock };
    company: { findMany: jest.Mock };
    notificationPreference: { findUnique: jest.Mock };
  };
  let redis: { get: jest.Mock; setex: jest.Mock };
  let repository: {
    findPeopleRecommendations: jest.Mock;
    findJobRecommendations: jest.Mock;
    findCompanyRecommendations: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn() },
      job: { findMany: jest.fn() },
      company: { findMany: jest.fn() },
      notificationPreference: { findUnique: jest.fn() },
    };

    redis = { get: jest.fn(), setex: jest.fn() };
    repository = {
      findPeopleRecommendations: jest.fn(),
      findJobRecommendations: jest.fn(),
      findCompanyRecommendations: jest.fn(),
    };

    service = new RecommendationsService(
      prisma as unknown as PrismaService,
      repository as unknown as RecommendationsRepository,
      redis as unknown as Redis,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPeopleRecommendations', () => {
    it('returns cached result when available (first page only)', async () => {
      const cached = {
        data: [
          {
            id: 'u2',
            displayName: 'Bob',
            headline: null,
            location: null,
            profilePictureUrl: null,
          },
        ],
        meta: { hasNextPage: false, limit: 20 },
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result).toEqual(cached);
      expect(repository.findPeopleRecommendations).not.toHaveBeenCalled();
    });

    it('bypasses cache when cursor is provided', async () => {
      redis.get.mockResolvedValue(null);
      repository.findPeopleRecommendations.mockResolvedValue([]);

      const result = await service.getPeopleRecommendations(
        'u1',
        'some-cursor',
        20,
      );

      expect(result).toEqual({
        data: [],
        meta: { hasNextPage: false, limit: 20 },
      });
      // Cache should NOT be written for non-first page
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('returns empty when no recommendations', async () => {
      redis.get.mockResolvedValue(null);
      repository.findPeopleRecommendations.mockResolvedValue([]);

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result).toEqual({
        data: [],
        meta: { hasNextPage: false, limit: 20 },
      });
    });

    it('handles Redis unavailable gracefully', async () => {
      redis.get.mockRejectedValue(new Error('Redis down'));
      repository.findPeopleRecommendations.mockResolvedValue([]);

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result.data).toEqual([]);
    });

    it('enriches scored IDs with user data and strips score', async () => {
      redis.get.mockResolvedValue(null);
      repository.findPeopleRecommendations.mockResolvedValue([
        { id: 'user-2', score: 5 },
        { id: 'user-3', score: 3 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          displayName: 'Alice',
          profile: {
            headline: 'Engineer',
            location: 'SF',
          },
        },
        {
          id: 'user-3',
          displayName: 'Bob',
          profile: {
            headline: 'Designer',
            location: 'NYC',
          },
        },
      ]);

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 'user-2',
        displayName: 'Alice',
      });
      // score should NOT be in response
      expect(result.data[0]).not.toHaveProperty('score');
    });

    it('skips scored IDs that are not found in the database', async () => {
      redis.get.mockResolvedValue(null);
      repository.findPeopleRecommendations.mockResolvedValue([
        { id: 'user-2', score: 5 },
        { id: 'missing-user', score: 3 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          displayName: 'Alice',
          profile: { headline: null, location: null },
        },
      ]);

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('user-2');
    });

    it('sets hasNextPage=true and slices to limit when repository returns limit+1 rows', async () => {
      redis.get.mockResolvedValue(null);
      const limit = 2;
      repository.findPeopleRecommendations.mockResolvedValue([
        { id: 'user-2', score: 10 },
        { id: 'user-3', score: 8 },
        { id: 'user-4', score: 5 }, // limit+1 row, should NOT appear in data
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          displayName: 'Alice',
          profile: { headline: 'Engineer', location: 'SF' },
        },
        {
          id: 'user-3',
          displayName: 'Bob',
          profile: { headline: 'Designer', location: 'NYC' },
        },
      ]);
      // user-4 should NOT be fetched (sentinel row enrichment is skipped)

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        limit,
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('user-2');
      expect(result.data[1].id).toBe('user-3');
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.limit).toBe(limit);
      expect(result.data).not.toContainEqual(
        expect.objectContaining({ id: 'user-4' }),
      );
    });

    it('generates nextCursor when hasNextPage is true', async () => {
      redis.get.mockResolvedValue(null);
      const limit = 2;
      repository.findPeopleRecommendations.mockResolvedValue([
        { id: 'user-2', score: 10 },
        { id: 'user-3', score: 8 },
        { id: 'user-4', score: 5 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          displayName: 'Alice',
          profile: { headline: 'Engineer', location: 'SF' },
        },
        {
          id: 'user-3',
          displayName: 'Bob',
          profile: { headline: 'Designer', location: 'NYC' },
        },
      ]);

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        limit,
      );

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
      expect(typeof result.meta.nextCursor).toBe('string');
      // nextCursor should be a base64-encoded JSON string with score and id
      const decoded = JSON.parse(
        Buffer.from(result.meta.nextCursor!, 'base64').toString('utf8'),
      );
      expect(decoded).toEqual({ score: 8, id: 'user-3' });
    });

    it('does not set nextCursor when hasNextPage is false', async () => {
      redis.get.mockResolvedValue(null);
      repository.findPeopleRecommendations.mockResolvedValue([
        { id: 'user-2', score: 5 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          displayName: 'Alice',
          profile: { headline: null, location: null },
        },
      ]);

      const result = await service.getPeopleRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.nextCursor).toBeUndefined();
    });
  });

  describe('getJobRecommendations', () => {
    it('returns empty when jobRecommendation preference is false', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        jobRecommendation: false,
      });

      const result = await service.getJobRecommendations('u1', undefined, 20);

      expect(result).toEqual({
        data: [],
        meta: { hasNextPage: false, limit: 20 },
      });
      expect(repository.findJobRecommendations).not.toHaveBeenCalled();
    });

    it('proceeds when notificationPreference is null (no preference row)', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);
      repository.findJobRecommendations.mockResolvedValue([]);

      const result = await service.getJobRecommendations('u1', undefined, 20);

      expect(result).toEqual({
        data: [],
        meta: { hasNextPage: false, limit: 20 },
      });
    });

    it('returns cached result when available (first page only)', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      const cached = {
        data: [
          {
            id: 'job-1',
            title: 'Engineer',
            companyName: 'Acme',
            location: null,
            employmentType: 'FULL_TIME',
            workplaceType: 'REMOTE',
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            publishedAt: null,
          },
        ],
        meta: { hasNextPage: false, limit: 20 },
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getJobRecommendations('u1', undefined, 20);

      expect(result).toEqual(cached);
    });

    it('bypasses cache when cursor is provided', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);
      repository.findJobRecommendations.mockResolvedValue([]);

      const result = await service.getJobRecommendations('u1', 'cursor', 20);

      expect(result).toEqual({
        data: [],
        meta: { hasNextPage: false, limit: 20 },
      });
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('enriches scored job IDs with job data and strips score', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);
      repository.findJobRecommendations.mockResolvedValue([
        { id: 'job-1', score: 8 },
      ]);
      prisma.job.findMany.mockResolvedValue([
        {
          id: 'job-1',
          title: 'Engineer',
          location: 'Remote',
          employmentType: 'FULL_TIME',
          workplaceType: 'REMOTE',
          salaryMin: 50000,
          salaryMax: 100000,
          salaryCurrency: 'USD',
          publishedAt: new Date('2026-01-01'),
          company: { name: 'Acme Corp' },
        },
      ]);

      const result = await service.getJobRecommendations('u1', undefined, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'job-1',
        title: 'Engineer',
        companyName: 'Acme Corp',
        salaryMin: 50000,
        salaryMax: 100000,
      });
      expect(result.data[0]).not.toHaveProperty('score');
    });

    it('sets hasNextPage=true and slices to limit when repository returns limit+1 rows', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);
      const limit = 2;
      repository.findJobRecommendations.mockResolvedValue([
        { id: 'job-1', score: 10 },
        { id: 'job-2', score: 8 },
        { id: 'job-3', score: 5 }, // limit+1, should not appear
      ]);
      prisma.job.findMany.mockResolvedValue([
        {
          id: 'job-1',
          title: 'Senior Engineer',
          location: 'Remote',
          employmentType: 'FULL_TIME',
          workplaceType: 'REMOTE',
          salaryMin: 80000,
          salaryMax: 120000,
          salaryCurrency: 'USD',
          publishedAt: new Date('2026-01-01'),
          company: { name: 'Acme Corp' },
        },
        {
          id: 'job-2',
          title: 'Junior Engineer',
          location: 'NYC',
          employmentType: 'FULL_TIME',
          workplaceType: 'ONSITE',
          salaryMin: 50000,
          salaryMax: 70000,
          salaryCurrency: 'USD',
          publishedAt: new Date('2026-02-01'),
          company: { name: 'Beta Inc' },
        },
      ]);
      // job-3 should NOT be fetched (sentinel row enrichment is skipped)

      const result = await service.getJobRecommendations(
        'u1',
        undefined,
        limit,
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.data).not.toContainEqual(
        expect.objectContaining({ id: 'job-3' }),
      );
    });

    it('generates nextCursor when hasNextPage is true', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);
      const limit = 2;
      repository.findJobRecommendations.mockResolvedValue([
        { id: 'job-1', score: 10 },
        { id: 'job-2', score: 8 },
        { id: 'job-3', score: 5 },
      ]);
      prisma.job.findMany.mockResolvedValue([
        {
          id: 'job-1',
          title: 'Senior',
          location: null,
          employmentType: 'FULL_TIME',
          workplaceType: 'REMOTE',
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          publishedAt: null,
          company: { name: 'Acme' },
        },
        {
          id: 'job-2',
          title: 'Junior',
          location: null,
          employmentType: 'FULL_TIME',
          workplaceType: 'ONSITE',
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          publishedAt: null,
          company: { name: 'Beta' },
        },
      ]);

      const result = await service.getJobRecommendations(
        'u1',
        undefined,
        limit,
      );

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
      const decoded = JSON.parse(
        Buffer.from(result.meta.nextCursor!, 'base64').toString('utf8'),
      );
      expect(decoded).toEqual({ score: 8, id: 'job-2' });
    });
  });

  describe('getCompanyRecommendations', () => {
    it('returns cached result when available (first page only)', async () => {
      const cached = {
        data: [
          {
            id: 'company-1',
            name: 'Acme',
            industry: null,
            followerCount: 10,
            verified: false,
            logoUrl: null,
          },
        ],
        meta: { hasNextPage: false, limit: 20 },
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getCompanyRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result).toEqual(cached);
    });

    it('bypasses cache when cursor is provided', async () => {
      redis.get.mockResolvedValue(null);
      repository.findCompanyRecommendations.mockResolvedValue([]);

      const result = await service.getCompanyRecommendations(
        'u1',
        'cursor',
        20,
      );

      expect(result).toEqual({
        data: [],
        meta: { hasNextPage: false, limit: 20 },
      });
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('returns empty when no recommendations', async () => {
      redis.get.mockResolvedValue(null);
      repository.findCompanyRecommendations.mockResolvedValue([]);

      const result = await service.getCompanyRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result).toEqual({
        data: [],
        meta: { hasNextPage: false, limit: 20 },
      });
    });

    it('enriches scored company IDs with company data and strips score', async () => {
      redis.get.mockResolvedValue(null);
      repository.findCompanyRecommendations.mockResolvedValue([
        { id: 'company-1', score: 4 },
      ]);
      prisma.company.findMany.mockResolvedValue([
        {
          id: 'company-1',
          name: 'Acme Corp',
          industry: 'Technology',
          verified: true,
          _count: { followers: 100 },
        },
      ]);

      const result = await service.getCompanyRecommendations(
        'u1',
        undefined,
        20,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'company-1',
        name: 'Acme Corp',
        industry: 'Technology',
        verified: true,
      });
      expect(result.data[0]).not.toHaveProperty('score');
    });

    it('sets hasNextPage=true and slices to limit when repository returns limit+1 rows', async () => {
      redis.get.mockResolvedValue(null);
      const limit = 2;
      repository.findCompanyRecommendations.mockResolvedValue([
        { id: 'company-1', score: 8 },
        { id: 'company-2', score: 5 },
        { id: 'company-3', score: 3 }, // limit+1
      ]);
      prisma.company.findMany.mockResolvedValue([
        {
          id: 'company-1',
          name: 'Acme Corp',
          industry: 'Technology',
          verified: true,
          _count: { followers: 100 },
        },
        {
          id: 'company-2',
          name: 'Beta Inc',
          industry: 'Finance',
          verified: false,
          _count: { followers: 50 },
        },
      ]);
      // company-3 should NOT be fetched (sentinel row enrichment is skipped)

      const result = await service.getCompanyRecommendations(
        'u1',
        undefined,
        limit,
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.data).not.toContainEqual(
        expect.objectContaining({ id: 'company-3' }),
      );
    });

    it('generates nextCursor when hasNextPage is true', async () => {
      redis.get.mockResolvedValue(null);
      const limit = 2;
      repository.findCompanyRecommendations.mockResolvedValue([
        { id: 'company-1', score: 8 },
        { id: 'company-2', score: 5 },
        { id: 'company-3', score: 3 },
      ]);
      prisma.company.findMany.mockResolvedValue([
        {
          id: 'company-1',
          name: 'Acme Corp',
          industry: 'Technology',
          verified: true,
          _count: { followers: 100 },
        },
        {
          id: 'company-2',
          name: 'Beta Inc',
          industry: 'Finance',
          verified: false,
          _count: { followers: 50 },
        },
      ]);

      const result = await service.getCompanyRecommendations(
        'u1',
        undefined,
        limit,
      );

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
      const decoded = JSON.parse(
        Buffer.from(result.meta.nextCursor!, 'base64').toString('utf8'),
      );
      expect(decoded).toEqual({ score: 5, id: 'company-2' });
    });
  });
});
