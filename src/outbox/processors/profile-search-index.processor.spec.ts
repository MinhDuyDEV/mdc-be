import { ProfileSearchIndexProcessor } from './profile-search-index.processor';

interface MockPrisma {
  profile: { findUnique: jest.Mock; findFirst: jest.Mock };
}

interface MockSearchIndex {
  indexDocument: jest.Mock;
  deleteByQuery: jest.Mock;
}

function createProcessor(overrides?: {
  findFirstResult?: Record<string, unknown> | null;
}) {
  const prisma: MockPrisma = {
    profile: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(
        overrides?.findFirstResult !== undefined
          ? overrides.findFirstResult
          : {
              id: 'profile-1',
              userId: 'user-1',
              visibility: 'PUBLIC',
              headline: 'Developer',
              about: 'About me',
              location: 'SF',
              skills: [{ name: 'TypeScript' }, { name: 'NestJS' }],
              createdAt: new Date('2026-01-01'),
              updatedAt: new Date('2026-01-02'),
              user: { id: 'user-1', displayName: 'John Doe' },
            },
      ),
    },
  };

  const searchIndex: MockSearchIndex = {
    indexDocument: jest.fn().mockResolvedValue(undefined),
    deleteByQuery: jest.fn().mockResolvedValue(undefined),
  };

  const processor = new ProfileSearchIndexProcessor(
    prisma as never,
    searchIndex as never,
  );

  return { processor, prisma, searchIndex };
}

describe('ProfileSearchIndexProcessor', () => {
  describe('processProfileUpdated', () => {
    it('should index public profile', async () => {
      const { processor, searchIndex } = createProcessor();
      await processor.processProfileUpdated({
        profileId: 'profile-1',
        userId: 'user-1',
      });

      expect(searchIndex.indexDocument).toHaveBeenCalledWith(
        'profiles',
        'profile-1',
        expect.objectContaining({
          displayName: 'John Doe',
          skills: ['TypeScript', 'NestJS'],
        }),
      );
    });

    it('should remove non-public profile from ES', async () => {
      const { processor, searchIndex } = createProcessor({
        findFirstResult: {
          id: 'profile-1',
          userId: 'user-1',
          visibility: 'PRIVATE',
          headline: 'Developer',
          about: 'About me',
          location: 'SF',
          skills: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-1', displayName: 'John Doe' },
        },
      });

      await processor.processProfileUpdated({
        profileId: 'profile-1',
        userId: 'user-1',
      });

      expect(searchIndex.deleteByQuery).toHaveBeenCalledWith('profiles', {
        term: { id: 'profile-1' },
      });
      expect(searchIndex.indexDocument).not.toHaveBeenCalled();
    });

    it('should skip when profile not found', async () => {
      const { processor, searchIndex } = createProcessor({
        findFirstResult: null,
      });

      await processor.processProfileUpdated({
        profileId: 'nonexistent',
        userId: 'user-1',
      });

      expect(searchIndex.indexDocument).not.toHaveBeenCalled();
      expect(searchIndex.deleteByQuery).not.toHaveBeenCalled();
    });
  });
});
