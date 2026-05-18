import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AppConfig } from "../infra/config/app-config";
import { PrismaService } from "../infra/prisma/prisma.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

describe("TokenService", () => {
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
            refreshToken: {
              findFirst: jest.fn(),
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
                jwtAccessSecret: "test-access-secret",
                jwtAccessExpiresIn: "15m",
                jwtRefreshSecret: "test-refresh-secret",
                jwtRefreshExpiresIn: "7d",
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

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("generateAccessToken", () => {
    it("should generate access token with correct payload", async () => {
      const userId = "user-123";
      const email = "test@example.com";
      const token = "access-token";

      jest.spyOn(jwtService, "signAsync").mockResolvedValue(token);

      const result = await service.generateAccessToken(userId, email);

      expect(result).toBe(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: userId, email },
        { secret: "test-access-secret", expiresIn: "15m" },
      );
    });
  });

  describe("validateAndRotateRefreshToken", () => {
    it("should throw UnauthorizedException if token reused", async () => {
      const userId = "user-123";
      const token = "refresh-token";
      const familyId = "family-123";

      jest.spyOn(prisma.refreshToken, "findFirst").mockResolvedValue({
        id: "token-123",
        userId,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await expect(
        service.validateAndRotateRefreshToken(userId, token, familyId),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });
});
