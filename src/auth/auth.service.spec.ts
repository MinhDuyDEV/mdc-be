import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let emailVerificationService: EmailVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn(),
            compare: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: {
            generateToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    passwordService = module.get<PasswordService>(PasswordService);
    tokenService = module.get<TokenService>(TokenService);
    emailVerificationService = module.get<EmailVerificationService>(
      EmailVerificationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create user with hashed password', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const hashedPassword = '$2b$12$...';

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(passwordService, 'hash').mockResolvedValue(hashedPassword);
      jest.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'user-123',
        email: dto.email,
        passwordHash: hashedPassword,
        displayName: null,
        emailVerifiedAt: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest
        .spyOn(emailVerificationService, 'generateToken')
        .mockResolvedValue('verification-token');

      const result = await service.register(dto);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: dto.email,
        }),
      );
      expect(passwordService.hash).toHaveBeenCalledWith(dto.password);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      const dto = { email: 'existing@example.com', password: 'password123' };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'existing-id',
        email: dto.email,
      } as any);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return token pair for valid credentials', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const accessToken = 'access.token.jwt';
      const refreshToken = 'refresh-uuid';
      const familyId = 'family-uuid';

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-123',
        email: dto.email,
        passwordHash: '$2b$12$hash', displayName: null,
        status: 'ACTIVE',
      } as any);
      jest.spyOn(passwordService, 'compare').mockResolvedValue(true);
      jest
        .spyOn(tokenService, 'generateAccessToken')
        .mockResolvedValue(accessToken);
      jest
        .spyOn(tokenService, 'generateRefreshToken')
        .mockResolvedValue({ token: refreshToken, familyId });

      const result = await service.login(dto);

      expect(result).toEqual({
        accessToken,
        refreshToken,
        user: {
          id: 'user-123',
          email: dto.email,
          emailVerifiedAt: undefined,
        },
      });
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
        'user-123',
        dto.email,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const dto = { email: 'test@example.com', password: 'wrong' };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-123',
        email: dto.email,
        passwordHash: '$2b$12$hash', displayName: null,
        status: 'ACTIVE',
      } as any);
      jest.spyOn(passwordService, 'compare').mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@user.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for disabled user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hash', displayName: null,
        status: 'DISABLED',
      } as any);

      await expect(
        service.login({ email: 'test@example.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
