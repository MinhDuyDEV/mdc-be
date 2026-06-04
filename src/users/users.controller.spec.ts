import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let profilesService: ProfilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getOwnProfile: jest.fn(),
            updateOwnProfile: jest.fn(),
          },
        },
        {
          provide: ProfilesService,
          useValue: {
            getPublicProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    profilesService = module.get<ProfilesService>(ProfilesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/me', () => {
    it('should call usersService.getOwnProfile', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const profile = { id: 'user-123', email: 'test@example.com' };
      jest
        .spyOn(usersService, 'getOwnProfile')
        .mockResolvedValue(profile as any);

      const result = await controller.getMe(user);
      expect(result).toEqual(profile);
    });
  });

  describe('PATCH /users/me', () => {
    it('should call usersService.updateOwnProfile', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const dto = { displayName: 'New' };
      jest.spyOn(usersService, 'updateOwnProfile').mockResolvedValue({} as any);

      await controller.updateMe(user, dto);
      expect(usersService.updateOwnProfile).toHaveBeenCalledWith(user, dto);
    });
  });

  describe('GET /users/:id', () => {
    it('should delegate to profilesService.getPublicProfile', async () => {
      const profile = { id: 'profile-123', userId: 'user-123' };
      jest
        .spyOn(profilesService, 'getPublicProfile')
        .mockResolvedValue(profile as any);

      const result = await controller.getUser('user-123', undefined);
      expect(result).toEqual(profile);
      expect(profilesService.getPublicProfile).toHaveBeenCalledWith(
        'user-123',
        undefined,
      );
    });
  });
});
