import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, RefreshToken } from '@prisma/client';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { AppConfig } from '../infra/config/app-config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PasswordService } from './password.service';
import { parseExpiresInToDate } from './token-expiry.util';

type RefreshTokenWriter = Pick<Prisma.TransactionClient, 'refreshToken'>;

interface ParsedOpaqueRefreshToken {
  tokenId: string;
  secret: string;
}

interface MatchedRefreshToken {
  token: RefreshToken;
  parsed: ParsedOpaqueRefreshToken | null;
}

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
      secret: this.configService.get('jwtAccessSecret', { infer: true }),
      expiresIn: this.configService.get('jwtAccessExpiresIn', { infer: true }),
    });
  }

  async generateRefreshToken(
    userId: string,
    familyId?: string,
    parentTokenId?: string,
  ): Promise<{ token: string; familyId: string }> {
    return this.createRefreshToken(
      this.prisma,
      userId,
      familyId,
      parentTokenId,
    );
  }

  async validateAndRotateRefreshToken(
    token: string,
  ): Promise<{ newToken: string; newFamilyId: string; userId: string }> {
    const match = await this.findRefreshToken(token);
    if (!match) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    this.assertPresentedTokenMatches(match);

    if (match.token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (match.token.revokedAt) {
      await this.revokeRefreshTokenFamily(match.token.familyId);
      throw new UnauthorizedException('Token reuse detected');
    }

    const now = new Date();
    const tokenId = match.token.id;
    const familyId = match.token.familyId;
    const userId = match.token.userId;
    let rotated: { token: string; familyId: string } | undefined;

    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: tokenId, revokedAt: null },
        data: { revokedAt: now },
      });

      if (revoked.count === 0) {
        await tx.refreshToken.updateMany({
          where: { familyId },
          data: { revokedAt: now },
        });
        throw new UnauthorizedException('Token reuse detected');
      }

      rotated = await this.createRefreshToken(tx, userId, familyId, tokenId);
    });

    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return {
      newToken: rotated.token,
      newFamilyId: rotated.familyId,
      userId,
    };
  }

  async revokeRefreshToken(userId: string, token: string): Promise<void> {
    const match = await this.findRefreshToken(token);
    if (!match || match.token.userId !== userId) {
      return;
    }

    try {
      this.assertPresentedTokenMatches(match);
    } catch {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: match.token.id },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefreshToken(
    client: RefreshTokenWriter,
    userId: string,
    familyId?: string,
    parentTokenId?: string,
  ): Promise<{ token: string; familyId: string }> {
    const tokenId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const tokenHash = this.hashRefreshSecret(secret);
    const family = familyId || tokenId;
    const expiresIn = this.configService.get('jwtRefreshExpiresIn', {
      infer: true,
    });
    const expiresAt = parseExpiresInToDate(expiresIn);

    await client.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash,
        familyId: family,
        parentTokenId: parentTokenId ?? null,
        expiresAt,
      },
    });

    return { token: `${tokenId}.${secret}`, familyId: family };
  }

  private async findRefreshToken(
    presentedToken: string,
  ): Promise<MatchedRefreshToken | null> {
    const parsed = this.parseOpaqueRefreshToken(presentedToken);
    if (parsed) {
      const token = await this.prisma.refreshToken.findUnique({
        where: { id: parsed.tokenId },
      });
      return token ? { token, parsed } : null;
    }

    const token = await this.findLegacyRefreshToken(presentedToken);
    return token ? { token, parsed: null } : null;
  }

  private parseOpaqueRefreshToken(
    token: string,
  ): ParsedOpaqueRefreshToken | null {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }

    return { tokenId: parts[0], secret: parts[1] };
  }

  private async findLegacyRefreshToken(
    presentedToken: string,
  ): Promise<RefreshToken | null> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    for (const candidate of candidates) {
      if (!this.isLegacyBcryptHash(candidate.tokenHash)) {
        continue;
      }
      if (
        await this.passwordService.compare(presentedToken, candidate.tokenHash)
      ) {
        return candidate;
      }
    }

    return null;
  }

  private assertPresentedTokenMatches(match: MatchedRefreshToken): void {
    if (!match.parsed) {
      return;
    }

    if (!this.isSha256Hex(match.token.tokenHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const actual = Buffer.from(
      this.hashRefreshSecret(match.parsed.secret),
      'hex',
    );
    const expected = Buffer.from(match.token.tokenHash, 'hex');
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: { revokedAt: new Date() },
    });
  }

  private hashRefreshSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private isSha256Hex(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }

  private isLegacyBcryptHash(value: string): boolean {
    return /^\$2[aby]\$\d{2}\$/.test(value);
  }
}
