import { JobSearchIndexProcessor } from './job-search-index.processor';

interface MockPrisma {
  job: { findUnique: jest.Mock };
}

interface MockSearchIndex {
  indexDocument: jest.Mock;
  deleteByQuery: jest.Mock;
}

const mockJob = {
  id: 'job-1',
  title: 'Software Engineer',
  description: 'Build awesome things',
  companyId: 'company-1',
  location: 'Remote',
  salaryMin: 100000,
  salaryMax: 150000,
  salaryCurrency: 'USD',
  employmentType: 'FULL_TIME' as const,
  workplaceType: 'REMOTE' as const,
  status: 'PUBLISHED' as const,
  publishedAt: new Date('2026-06-01'),
  closedAt: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  applyMode: 'INTERNAL' as const,
  applyUrl: null,
  createdByUserId: 'user-1',
  searchVector: null,
  company: {
    id: 'company-1',
    name: 'Tech Corp',
    slug: 'tech-corp',
  },
  skills: [{ id: 'skill-rel-1', jobId: 'job-1', skillId: 'skill-ts' }],
};

function createProcessor(overrides?: {
  findUniqueResult?: Record<string, unknown> | null;
}) {
  const prisma: MockPrisma = {
    job: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides?.findUniqueResult !== undefined
            ? overrides.findUniqueResult
            : mockJob,
        ),
    },
  };

  const searchIndex: MockSearchIndex = {
    indexDocument: jest.fn().mockResolvedValue(undefined),
    deleteByQuery: jest.fn().mockResolvedValue(undefined),
  };

  const processor = new JobSearchIndexProcessor(
    prisma as never,
    searchIndex as never,
  );

  return { processor, prisma, searchIndex };
}

describe('JobSearchIndexProcessor', () => {
  describe('processJobCreated', () => {
    it('indexes the job document', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobCreated({ jobId: 'job-1' });
      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'jobs',
        'job-1',
        expect.objectContaining({ title: 'Software Engineer' }),
      );
    });
  });

  describe('processJobUpdated', () => {
    it('indexes the job document', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobUpdated({ jobId: 'job-1' });
      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'jobs',
        'job-1',
        expect.objectContaining({ status: 'PUBLISHED' }),
      );
    });
  });

  describe('processJobPublished', () => {
    it('indexes the job document', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobPublished({ jobId: 'job-1' });
      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'jobs',
        'job-1',
        expect.objectContaining({ workplaceType: 'REMOTE' }),
      );
    });
  });

  describe('processJobClosed', () => {
    it('indexes the job document', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobClosed({ jobId: 'job-1' });
      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'jobs',
        'job-1',
        expect.objectContaining({ employmentType: 'FULL_TIME' }),
      );
    });
  });

  describe('processJobDeleted', () => {
    it('removes the job from ES', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobDeleted({ jobId: 'job-1' });
      expect(searchIndex.deleteByQuery).toHaveBeenCalledWith('jobs', {
        term: { id: 'job-1' },
      });
      expect(searchIndex.indexDocument).not.toHaveBeenCalled();
    });
  });

  describe('job not found', () => {
    it('skips indexing when job is missing', async () => {
      const { processor, searchIndex } = createProcessor({
        findUniqueResult: null,
      });
      await processor.processJobCreated({ jobId: 'nonexistent' });
      expect(searchIndex.indexDocument).not.toHaveBeenCalled();
      expect(searchIndex.deleteByQuery).not.toHaveBeenCalled();
    });
  });

  describe('soft-deleted job', () => {
    it('removes from ES when job is soft-deleted', async () => {
      const { processor, searchIndex } = createProcessor({
        findUniqueResult: { ...mockJob, deletedAt: new Date() },
      });
      await processor.processJobCreated({ jobId: 'job-1' });
      expect(searchIndex.deleteByQuery).toHaveBeenCalledWith('jobs', {
        term: { id: 'job-1' },
      });
      expect(searchIndex.indexDocument).not.toHaveBeenCalled();
    });
  });

  describe('indexed document shape', () => {
    it('includes denormalized company info', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobCreated({ jobId: 'job-1' });
      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'jobs',
        'job-1',
        expect.objectContaining({
          companyName: 'Tech Corp',
          companySlug: 'tech-corp',
        }),
      );
    });

    it('maps skills to a skillId array', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobCreated({ jobId: 'job-1' });
      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'jobs',
        'job-1',
        expect.objectContaining({ skills: ['skill-ts'] }),
      );
    });

    it('includes salary currency and publishedAt', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processJobCreated({ jobId: 'job-1' });
      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'jobs',
        'job-1',
        expect.objectContaining({
          salaryCurrency: 'USD',
          publishedAt: '2026-06-01T00:00:00.000Z',
        }),
      );
    });
  });
});
