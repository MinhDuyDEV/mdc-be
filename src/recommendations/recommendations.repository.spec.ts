import type { PrismaService } from '../infra/prisma/prisma.service';
import { RecommendationsRepository } from './recommendations.repository';

interface MockPrisma {
  $queryRaw: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  return {
    $queryRaw: jest.fn(),
  };
}

describe('RecommendationsRepository', () => {
  let repository: RecommendationsRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = buildMockPrisma();
    repository = new RecommendationsRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findPeopleRecommendations', () => {
    it('returns scored user IDs from 2nd-degree connections', async () => {
      const mockRows = [
        { id: 'user-2', score: 3 },
        { id: 'user-3', score: 2 },
      ];
      prisma.$queryRaw.mockResolvedValue(mockRows);

      const result = await repository.findPeopleRecommendations(
        'user-1',
        undefined,
        20,
      );

      expect(result).toEqual(mockRows);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('applies cursor pagination', async () => {
      const cursor = Buffer.from(
        JSON.stringify({ score: 5, id: 'user-x' }),
      ).toString('base64');
      prisma.$queryRaw.mockResolvedValue([]);

      await repository.findPeopleRecommendations('user-1', cursor, 20);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no recommendations', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await repository.findPeopleRecommendations(
        'user-1',
        undefined,
        20,
      );

      expect(result).toEqual([]);
    });
  });

  describe('findJobRecommendations', () => {
    it('returns scored job IDs based on skill overlap', async () => {
      const mockRows = [
        { id: 'job-1', score: 8 },
        { id: 'job-2', score: 5 },
      ];
      prisma.$queryRaw.mockResolvedValue(mockRows);

      const result = await repository.findJobRecommendations(
        'user-1',
        undefined,
        20,
      );

      expect(result).toEqual(mockRows);
    });

    it('applies cursor pagination', async () => {
      const cursor = Buffer.from(
        JSON.stringify({ score: 10, id: 'job-x' }),
      ).toString('base64');
      prisma.$queryRaw.mockResolvedValue([]);

      await repository.findJobRecommendations('user-1', cursor, 20);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no matching jobs', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await repository.findJobRecommendations(
        'user-1',
        undefined,
        20,
      );

      expect(result).toEqual([]);
    });
  });

  describe('findCompanyRecommendations', () => {
    it('returns scored company IDs based on connection overlap', async () => {
      const mockRows = [
        { id: 'company-1', score: 4 },
        { id: 'company-2', score: 2 },
      ];
      prisma.$queryRaw.mockResolvedValue(mockRows);

      const result = await repository.findCompanyRecommendations(
        'user-1',
        undefined,
        20,
      );

      expect(result).toEqual(mockRows);
    });

    it('applies cursor pagination', async () => {
      const cursor = Buffer.from(
        JSON.stringify({ score: 6, id: 'company-x' }),
      ).toString('base64');
      prisma.$queryRaw.mockResolvedValue([]);

      await repository.findCompanyRecommendations('user-1', cursor, 20);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no matching companies', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await repository.findCompanyRecommendations(
        'user-1',
        undefined,
        20,
      );

      expect(result).toEqual([]);
    });
  });
});
