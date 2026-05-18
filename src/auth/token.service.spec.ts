import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { AppConfig } from "../infra/config/app-config";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

describe("TokenService", () => {
	let service: TokenService;
	let jwtService: JwtService;
	let prisma: Pick<PrismaService, "refreshToken">;
	let passwordService: PasswordService;
	let configService: ConfigService<AppConfig, true>;

	beforeEach(() => {
		jwtService = {
			signAsync: jest.fn(),
			verifyAsync: jest.fn(),
		} as unknown as JwtService;

		prisma = {
			refreshToken: {
				findFirst: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				updateMany: jest.fn(),
			},
		} as unknown as Pick<PrismaService, "refreshToken">;

		passwordService = {
			hash: jest.fn(),
			compare: jest.fn(),
		} as unknown as PasswordService;

		configService = {
			get: jest.fn((key: string) => {
				const config: Record<string, unknown> = {
					jwtAccessSecret: "test-access-secret",
					jwtAccessExpiresIn: "15m",
					jwtRefreshSecret: "test-refresh-secret",
					jwtRefreshExpiresIn: "7d",
				};
				return config[key];
			}),
		} as unknown as ConfigService<AppConfig, true>;

		service = new TokenService(
			jwtService,
			prisma as PrismaService,
			passwordService,
			configService,
		);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("generateAccessToken", () => {
		it("should generate access token with correct payload", async () => {
			const userId = "user-123";
			const email = "test@example.com";
			const token = "access-token";

			(jwtService.signAsync as jest.Mock).mockResolvedValue(token);

			const result = await service.generateAccessToken(userId, email);

			expect(result).toBe(token);
			expect(jwtService.signAsync).toHaveBeenCalledWith(
				{ sub: userId, email },
				{ secret: "test-access-secret", expiresIn: "15m" },
			);
		});
	});

	describe("validateAndRotateRefreshToken", () => {
		it("should throw UnauthorizedException if token was already revoked (reuse detection)", async () => {
			const userId = "user-123";
			const token = "refresh-token";
			const familyId = "family-123";

			(prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue({
				id: "token-123",
				userId,
				tokenHash: "hash",
				expiresAt: new Date(Date.now() + 86400000),
				revokedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			await expect(
				service.validateAndRotateRefreshToken(userId, token, familyId),
			).rejects.toThrow(UnauthorizedException);

			expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
		});
	});
});
