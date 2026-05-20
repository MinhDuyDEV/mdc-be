import { Logger } from '@nestjs/common';
import { JobSearchIndexProcessor } from './job-search-index.processor';

describe('JobSearchIndexProcessor', () => {
  const stubJob = { id: 'job-1', status: 'PUBLISHED', deletedAt: null };
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  function createProcessor() {
    const mockPrisma = {
      job: {
        findUnique: jest.fn().mockResolvedValue(stubJob),
      },
    };
    const processor = new JobSearchIndexProcessor(mockPrisma as never);
    return { processor, mockPrisma };
  }

  beforeEach(() => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();
  });

  const METHODS = [
    'processJobCreated',
    'processJobUpdated',
    'processJobPublished',
    'processJobClosed',
    'processJobDeleted',
  ] as const;

  describe.each(METHODS)('%s', (method) => {
    it('resolves without throwing and calls logger.debug when job exists', async () => {
      const { processor } = createProcessor();
      await expect(
        processor[method]({ jobId: 'job-1' }),
      ).resolves.toBeUndefined();
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('ES wiring deferred to Phase 9'),
      );
    });

    it('warns and returns gracefully when job is not found', async () => {
      const { processor, mockPrisma } = createProcessor();
      mockPrisma.job.findUnique.mockResolvedValue(null);
      await expect(
        processor[method]({ jobId: 'missing-id' }),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });
});
