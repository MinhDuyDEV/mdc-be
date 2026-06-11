import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';

import { PrismaService } from '../infra/prisma/prisma.service';
import { isUniqueConstraintError, slugify } from '../common/strings/slug';

import { OutboxService } from '../outbox/outbox.service';

import { EmailVerificationService } from './email-verification.service';

import { PasswordService } from './password.service';

import { TokenService } from './token.service';

interface RegisterDto {
  email: string;
  password: string;
  handle?: string;
  displayName?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly outboxService: OutboxService,
  ) {}

  // fallow-ignore-next-line complexity — intentional retry loop for handle uniqueness
  async register(dto: RegisterDto, ip?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Pre-compute base handle (atomically checked for uniqueness inside transaction)
    const baseHandle: string = dto.handle
      ? dto.handle
      : slugify(dto.displayName || dto.email.split('@')[0]).slice(0, 30) ||
        `user-${crypto.randomUUID().slice(0, 8)}`;

    const passwordHash = await this.passwordService.hash(dto.password);

    // fallow-ignore-next-line complexity — intentional: TOCTOU-safe handle retry inside tx
    const result = await this.prisma.$transaction(async (tx) => {
      // Generate unique handle inside transaction (TOCTOU-safe)
      let user: Awaited<ReturnType<typeof tx.user.create>> | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate =
          attempt === 0 ? baseHandle : `${baseHandle.slice(0, 25)}-${attempt}`;
        try {
          user = await tx.user.create({
            data: {
              email: dto.email,
              passwordHash,
              handle: candidate,
              displayName: dto.displayName,
            },
          });
          break;
        } catch (error: unknown) {
          if (!isUniqueConstraintError(error)) throw error;
          if (attempt >= 9) {
            throw new ConflictException('Unable to generate unique handle');
          }
        }
      }
      if (!user) {
        throw new ConflictException('Unable to generate unique handle');
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'user.registered',
          entityType: 'User',
          entityId: user.id,
          metadata: { email: user.email },
          ip,
          userAgent,
        },
      });

      // Emit outbox event
      await this.outboxService.emit(tx, {
        eventType: 'UserRegistered',
        aggregateType: 'User',
        aggregateId: user.id,
        payload: {
          userId: user.id,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        },
      });

      return user;
    });

    // Generate verification token (TBD: send via email in later task)
    try {
      await this.emailVerificationService.generateToken(result.id);
    } catch (error) {
      this.logger.error(
        `Failed to generate verification token for user ${result.id}`,
        error,
      );
    }

    this.logger.log(`User registered: ${result.id}`);

    return {
      id: result.id,
      email: result.email,
      emailVerifiedAt: result.emailVerifiedAt,
      status: result.status,
      createdAt: result.createdAt,
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.tokenService.generateAccessToken(
      user.id,
      user.email,
    );
    const { token: refreshToken } =
      await this.tokenService.generateRefreshToken(user.id);

    // Create audit log and emit outbox event
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'user.logged_in',
          entityType: 'User',
          entityId: user.id,
          metadata: { email: user.email },
          ip,
          userAgent,
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'UserLoggedIn',
        aggregateType: 'User',
        aggregateId: user.id,
        payload: {
          userId: user.id,
          email: user.email,
          loginAt: new Date().toISOString(),
        },
      });
    });

    this.logger.log(`User logged in: ${user.id}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
