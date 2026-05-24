import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Public } from '../common/auth/public.decorator';
import type { AppConfig } from '../infra/config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuthService } from './auth.service';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';
import { parseExpiresInToMs } from './token-expiry.util';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() request: Request) {
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];
    return this.authService.register(dto, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];
    const result = await this.authService.login(dto, ip, userAgent);

    response.cookie(
      'refreshToken',
      result.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const oldToken = (request.cookies as Record<string, string> | undefined)
      ?.refreshToken;
    if (!oldToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const { newToken, userId } =
      await this.tokenService.validateAndRotateRefreshToken(oldToken);

    // Generate new access token
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = await this.tokenService.generateAccessToken(
      user.id,
      user.email,
    );

    // Set new refresh token cookie
    response.cookie('refreshToken', newToken, this.getRefreshCookieOptions());

    return { accessToken, refreshToken: newToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = (request.cookies as Record<string, string> | undefined)
      ?.refreshToken;
    if (refreshToken && user) {
      await this.tokenService.revokeRefreshToken(user.id, refreshToken);
    }

    response.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.emailVerificationService.verifyToken(dto.token);
    return { message: 'Email verified successfully' };
  }

  @Public()
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    // Look up user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return success message to prevent email enumeration
    if (!user) {
      return {
        message: 'If the email exists, a new verification email has been sent',
      };
    }

    // Don't resend if already verified
    if (user.emailVerifiedAt) {
      return {
        message: 'If the email exists, a new verification email has been sent',
      };
    }

    // Generate new token
    const token = await this.emailVerificationService.generateToken(user.id);

    // Send email (simplified - in production this would use EmailService)
    // For now, just log it
    this.logger.log(`Verification token for ${user.email}: ${token}`);

    return {
      message: 'If the email exists, a new verification email has been sent',
    };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.passwordResetService.requestReset(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.passwordResetService.confirmReset(dto.token, dto.newPassword);
  }

  private getRefreshCookieOptions(): CookieOptions {
    const expiresIn = this.configService.get('jwtRefreshExpiresIn', {
      infer: true,
    });

    return {
      httpOnly: true,
      secure: this.configService.get('cookieSecure', { infer: true }),
      sameSite: this.configService.get('cookieSameSite', { infer: true }),
      maxAge: parseExpiresInToMs(expiresIn),
      path: '/api/v1/auth',
    };
  }
}
