import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';

import { PrismaService } from '../infra/prisma/prisma.service';
import { slugify } from '../common/strings/slug';

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

  async register(dto: RegisterDto, ip?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Generate unique handle
    let handle: string;
    if (dto.handle) {
      handle = dto.handle;
    } else {
      const baseHandle = slugify(
        dto.displayName || dto.email.split('@')[0],
      ).slice(0, 30);
      handle = baseHandle || `user-${crypto.randomUUID().slice(0, 8)}`;
    }
    // Ensure handle uniqueness
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate =
        attempt === 0 ? handle : `${handle.slice(0, 25)}-${attempt}`;
      const existingHandle = await this.prisma.user.findUnique({
        where: { handle: candidate },
      });
      if (!existingHandle) {
        handle = candidate;
        break;
      }
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    // Use transaction to ensure atomicity of user creation, audit log, and outbox event
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          handle,
          displayName: dto.displayName,
        },
      });

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
