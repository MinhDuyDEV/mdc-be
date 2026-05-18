import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getOwnProfile: jest.fn(),
            updateOwnProfile: jest.fn(),
            getPublicProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
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
    it('should call usersService.getPublicProfile', async () => {
      jest.spyOn(usersService, 'getPublicProfile').mockResolvedValue({} as any);

      await controller.getUser('user-123');
      expect(usersService.getPublicProfile).toHaveBeenCalledWith('user-123');
    });
  });
});
