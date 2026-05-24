import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import type { AppConfig } from '../infra/config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService<AppConfig, true>;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateAccessToken: jest.fn(),
            validateAndRotateRefreshToken: jest.fn(),
            revokeRefreshToken: jest.fn(),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: {
            generateToken: jest.fn(),
            verifyToken: jest.fn(),
          },
        },
        {
          provide: PasswordResetService,
          useValue: {
            requestReset: jest.fn(),
            confirmReset: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            refreshToken: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: keyof AppConfig) => {
              const values: Partial<AppConfig> = {
                cookieSecure: true,
                cookieSameSite: 'none',
                jwtRefreshExpiresIn: '2h',
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<AuthController>(AuthController);
    authService = moduleRef.get<AuthService>(AuthService);
    configService =
      moduleRef.get<ConfigService<AppConfig, true>>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register with dto', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const expected = { id: 'user-123', email: dto.email };
      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      } as any;
      jest.spyOn(authService, 'register').mockResolvedValue(expected as any);

      const result = await controller.register(dto, mockRequest);
      expect(result).toEqual(expected);
      expect(authService.register).toHaveBeenCalledWith(
        dto,
        '127.0.0.1',
        'test-agent',
      );
    });
  });

  describe('login', () => {
    it('sets refresh cookie options from ConfigService', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const loginResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user-123', email: dto.email, emailVerifiedAt: null },
      };
      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      } as unknown as Request;
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      jest.spyOn(authService, 'login').mockResolvedValue(loginResult);

      const result = await controller.login(dto, mockResponse, mockRequest);

      expect(result).toEqual({
        accessToken: loginResult.accessToken,
        user: loginResult.user,
      });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 2 * 60 * 60 * 1000,
          path: '/api/v1/auth',
        },
      );
      expect(configService.get).toHaveBeenCalledWith('cookieSecure', {
        infer: true,
      });
      expect(configService.get).toHaveBeenCalledWith('cookieSameSite', {
        infer: true,
      });
      expect(configService.get).toHaveBeenCalledWith('jwtRefreshExpiresIn', {
        infer: true,
      });
    });
  });

  describe('refresh', () => {
    it('rotates with cookie only and does not require a bearer token', async () => {
      const tokenService = moduleRef.get<TokenService>(TokenService);
      const prisma = moduleRef.get<PrismaService>(PrismaService);
      const mockRequest = {
        cookies: { refreshToken: 'refresh-token' },
        headers: {},
      } as unknown as Request;
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      jest
        .spyOn(tokenService, 'validateAndRotateRefreshToken')
        .mockResolvedValue({
          newToken: 'new-refresh-token',
          newFamilyId: 'family-1',
          userId: 'user-123',
        });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      } as never);
      jest
        .spyOn(tokenService, 'generateAccessToken')
        .mockResolvedValue('new-access-token');

      const result = await controller.refresh(mockRequest, mockResponse);

      expect(tokenService.validateAndRotateRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
      );
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/v1/auth',
        }),
      );
    });
  });

  describe('password reset', () => {
    it('should have requestPasswordReset endpoint', () => {
      expect(controller.requestPasswordReset).toBeDefined();
    });

    it('should have confirmPasswordReset endpoint', () => {
      expect(controller.confirmPasswordReset).toBeDefined();
    });
  });
});
