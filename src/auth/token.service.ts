import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import type { AppConfig } from "../infra/config/app-config";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { PasswordService } from "./password.service";

@Injectable()
export class TokenService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly prisma: PrismaService,
		private readonly passwordService: PasswordService,
		private readonly configService: ConfigService<AppConfig, true>,
	) {}

	async generateAccessToken(userId: string, email: string): Promise<string> {
		const payload = { sub: userId, email };
		return this.jwtService.signAsync(payload, {
			secret: this.configService.get("jwtAccessSecret", { infer: true }),
			expiresIn: this.configService.get("jwtAccessExpiresIn", { infer: true }),
		});
	}

	async generateRefreshToken(
		userId: string,
		familyId?: string,
	): Promise<{ token: string; familyId: string }> {
		const token = randomUUID();
		const tokenHash = await this.passwordService.hash(token);
		const family = familyId || randomUUID();
		const expiresIn = this.configService.get("jwtRefreshExpiresIn", {
			infer: true,
		});
		const expiresAt = this.parseExpiresIn(expiresIn);

		await this.prisma.refreshToken.create({
			data: {
				userId,
				tokenHash,
				expiresAt,
			},
		});

		return { token, familyId: family };
	}

	async validateAndRotateRefreshToken(
		userId: string,
		token: string,
		familyId: string,
	): Promise<{ newToken: string; newFamilyId: string }> {
		const stored = await this.prisma.refreshToken.findFirst({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});

		if (!stored || stored.expiresAt < new Date()) {
			throw new UnauthorizedException("Invalid or expired refresh token");
		}

		// Reuse detection
		if (stored.revokedAt) {
			await this.prisma.refreshToken.updateMany({
				where: { userId },
				data: { revokedAt: new Date() },
			});
			throw new UnauthorizedException("Token reuse detected");
		}

		const isValid = await this.passwordService.compare(token, stored.tokenHash);
		if (!isValid) {
			await this.prisma.refreshToken.updateMany({
				where: { userId },
				data: { revokedAt: new Date() },
			});
			throw new UnauthorizedException("Invalid refresh token");
		}

		// Revoke used token
		await this.prisma.refreshToken.update({
			where: { id: stored.id },
			data: { revokedAt: new Date() },
		});

		// Generate new pair
		const { token: newToken, familyId: newFamilyId } =
			await this.generateRefreshToken(userId, familyId);
		return { newToken, newFamilyId };
	}

	async revokeRefreshToken(userId: string, token: string): Promise<void> {
		const stored = await this.prisma.refreshToken.findFirst({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});

		if (stored) {
			const isValid = await this.passwordService.compare(
				token,
				stored.tokenHash,
			);
			if (isValid) {
				await this.prisma.refreshToken.update({
					where: { id: stored.id },
					data: { revokedAt: new Date() },
				});
			}
		}
	}

	private parseExpiresIn(expiresIn: string): Date {
		const match = expiresIn.match(/^(\d+)([smhd])$/);
		if (!match) throw new Error(`Invalid expiresIn format: ${expiresIn}`);

		const value = parseInt(match[1], 10);
		const unit = match[2];

		const ms = {
			s: value * 1000,
			m: value * 60 * 1000,
			h: value * 60 * 60 * 1000,
			d: value * 24 * 60 * 60 * 1000,
		}[unit];

		return new Date(Date.now() + ms!);
	}
}
