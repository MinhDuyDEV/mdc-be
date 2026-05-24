import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

function sha256(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((fn) =>
              fn({
                refreshToken: {
                  create: jest.fn(),
                  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
              }),
            ),
            refreshToken: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
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
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                jwtAccessSecret: 'test-access-secret',
                jwtAccessExpiresIn: '15m',
                jwtRefreshExpiresIn: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);
    passwordService = module.get<PasswordService>(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const token = 'access-token';

      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      const result = await service.generateAccessToken(userId, email);

      expect(result).toBe(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: userId, email },
        { secret: 'test-access-secret', expiresIn: '15m' },
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('stores an opaque token id with a sha256 secret hash', async () => {
      jest.spyOn(prisma.refreshToken, 'create').mockResolvedValue({} as never);

      const result = await service.generateRefreshToken('user-123');
      const [tokenId] = result.token.split('.');

      expect(result.token).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/);
      expect(result.familyId).toBe(tokenId);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: tokenId,
          userId: 'user-123',
          familyId: tokenId,
          parentTokenId: null,
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });
  });

  describe('validateAndRotateRefreshToken', () => {
    it('rotates by presented token id and keeps independent device families separate', async () => {
      const tokenId = '11111111-1111-4111-8111-111111111111';
      const secret = 'device-secret';
      const familyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      jest.spyOn(prisma.refreshToken, 'findUnique').mockResolvedValue({
        id: tokenId,
        userId: 'user-123',
        tokenHash: sha256(secret),
        familyId,
        parentTokenId: null,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const txRefreshToken = {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation((fn) =>
          fn({ refreshToken: txRefreshToken } as never),
        );

      const result = await service.validateAndRotateRefreshToken(
        `${tokenId}.${secret}`,
      );

      expect(result.userId).toBe('user-123');
      expect(result.newFamilyId).toBe(familyId);
      expect(txRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: tokenId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(txRefreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          familyId,
          parentTokenId: tokenId,
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });

    it('revokes only the matched family when a valid revoked token is replayed', async () => {
      const tokenId = '22222222-2222-4222-8222-222222222222';
      const secret = 'replayed-secret';
      const familyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      jest.spyOn(prisma.refreshToken, 'findUnique').mockResolvedValue({
        id: tokenId,
        userId: 'user-123',
        tokenHash: sha256(secret),
        familyId,
        parentTokenId: null,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.validateAndRotateRefreshToken(`${tokenId}.${secret}`),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does not revoke a family for an invalid secret', async () => {
      const tokenId = '33333333-3333-4333-8333-333333333333';
      jest.spyOn(prisma.refreshToken, 'findUnique').mockResolvedValue({
        id: tokenId,
        userId: 'user-123',
        tokenHash: sha256('real-secret'),
        familyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        parentTokenId: null,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.validateAndRotateRefreshToken(`${tokenId}.wrong-secret`),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('dual-reads legacy bcrypt refresh tokens until natural expiry', async () => {
      const legacyToken = 'legacy-refresh-token';
      const legacyHash =
        '$2b$12$LJ3m4ys3nGxDXZQGhVIyqOfYK5CxJNZY7vQQ5pEtZRVL7NW1Oa4Ke';
      jest.spyOn(prisma.refreshToken, 'findMany').mockResolvedValue([
        {
          id: '44444444-4444-4444-8444-444444444444',
          userId: 'user-123',
          tokenHash: legacyHash,
          familyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          parentTokenId: null,
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      jest.spyOn(passwordService, 'compare').mockResolvedValue(true);

      const txRefreshToken = {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation((fn) =>
          fn({ refreshToken: txRefreshToken } as never),
        );

      const result = await service.validateAndRotateRefreshToken(legacyToken);

      expect(result.userId).toBe('user-123');
      expect(passwordService.compare).toHaveBeenCalledWith(
        legacyToken,
        legacyHash,
      );
      expect(txRefreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          familyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          parentTokenId: '44444444-4444-4444-8444-444444444444',
        }),
      });
    });
  });
});
