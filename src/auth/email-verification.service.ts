import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { AppConfig } from '../infra/config';
import { MAILER_TRANSPORTER } from '../infra/mailer/mailer.constants';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PasswordService } from './password.service';

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(MAILER_TRANSPORTER)
    private readonly mailerService: {
      sendMail: (options: any) => Promise<any>;
    },
  ) {}

  async generateToken(userId: string): Promise<string> {
    // Invalidate any existing unused tokens for this user
    await this.prisma.verificationToken.updateMany({
      where: {
        userId,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await this.passwordService.hash(rawToken);

    await this.prisma.verificationToken.create({
      data: {
        userId,
        type: 'EMAIL_VERIFICATION',
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_EXPIRY_MS),
      },
    });

    return rawToken;
  }

  async verifyToken(rawToken: string, userId?: string): Promise<boolean> {
    const where: {
      type: 'EMAIL_VERIFICATION';
      usedAt: null;
      expiresAt: { gt: Date };
      userId?: string;
    } = {
      type: 'EMAIL_VERIFICATION',
      usedAt: null,
      expiresAt: { gt: new Date() },
    };

    // If userId is provided, filter by it for additional security
    if (userId) {
      where.userId = userId;
    }

    const tokens = await this.prisma.verificationToken.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    for (const token of tokens) {
      const isValid = await this.passwordService.compare(
        rawToken,
        token.tokenHash,
      );
      if (isValid) {
        // Double-check userId if provided
        if (userId && token.userId !== userId) {
          throw new BadRequestException('Token does not belong to this user');
        }

        await this.prisma.verificationToken.update({
          where: { id: token.id },
          data: { usedAt: new Date() },
        });

        await this.prisma.user.update({
          where: { id: token.userId },
          data: { emailVerifiedAt: new Date() },
        });

        return true;
      }
    }

    throw new BadRequestException('Invalid or expired verification token');
  }
}
