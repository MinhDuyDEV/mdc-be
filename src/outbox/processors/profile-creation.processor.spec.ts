import type { PrismaService } from '../../infra/prisma/prisma.service';
import { ProfileCreationProcessor } from './profile-creation.processor';

describe('ProfileCreationProcessor', () => {
  let prisma: {
    profile: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let processor: ProfileCreationProcessor;

  beforeEach(() => {
    prisma = {
      profile: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    processor = new ProfileCreationProcessor(
      prisma as unknown as PrismaService,
    );
  });

  it('creates a profile shell for a new registered user', async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.profile.create.mockResolvedValue({ id: 'profile-1' });

    await processor.processUserRegistered({
      userId: 'user-1',
      email: 'user@example.com',
    });

    expect(prisma.profile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true },
    });
    expect(prisma.profile.create).toHaveBeenCalledWith({
      data: { userId: 'user-1' },
      select: { id: true },
    });
  });

  it('skips when a profile already exists for the user', async () => {
    prisma.profile.findUnique.mockResolvedValue({ id: 'profile-1' });

    await processor.processUserRegistered({
      userId: 'user-1',
      email: 'user@example.com',
    });

    expect(prisma.profile.create).not.toHaveBeenCalled();
  });
});
