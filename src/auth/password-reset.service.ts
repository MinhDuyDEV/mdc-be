import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { AppConfig } from '../infra/config/app-config';
import {
  MAILER_TRANSPORTER,
  type MailerTransporter,
} from '../infra/mailer/mailer.constants';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const RESET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(MAILER_TRANSPORTER)
    private readonly mailerService: MailerTransporter,
  ) {}

  async requestReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status === 'DELETED') {
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    await this.prisma.verificationToken.updateMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await this.passwordService.hash(rawToken);

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_EXPIRY_MS),
      },
    });

    this.logger.log(`Password reset token generated for user ${user.id}`);

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async confirmReset(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const token = await this.prisma.verificationToken.findFirst({
      where: {
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const isValid = await this.passwordService.compare(
      rawToken,
      token.tokenHash,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    await this.prisma.verificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });

    const newHash = await this.passwordService.hash(newPassword);
    await this.prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash: newHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: token.userId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Password reset confirmed for user ${token.userId}`);

    return { message: 'Password has been reset successfully.' };
  }
}
