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
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Public } from '../common/auth/public.decorator';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuthService } from './auth.service';
import type { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import type { ResendVerificationDto } from './dto/resend-verification.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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
    const cookieSecure = process.env.COOKIE_SECURE === 'true';

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

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

    // Extract userId from the old access token (if present) or from the refresh token lookup
    // For now, we need to decode the access token to get userId
    const authHeader = request.headers.authorization;
    let userId: string;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const accessToken = authHeader.substring(7);
        // JwtService.decode returns null | { [key: string]: unknown } | string (from @nestjs/jwt)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const raw = this.jwtService.decode(accessToken);
        const decoded: { sub: string } | null =
          typeof raw === 'object' && raw !== null && 'sub' in raw
            ? (raw as { sub: string })
            : null;
        if (!decoded) {
          throw new UnauthorizedException('Invalid access token');
        }
        userId = decoded.sub;
      } catch {
        throw new UnauthorizedException('Invalid access token');
      }
    } else {
      throw new UnauthorizedException('Access token required for refresh');
    }

    // Validate and rotate refresh token
    const { newToken } = await this.tokenService.validateAndRotateRefreshToken(
      userId,
      oldToken,
      '', // familyId not tracked in current implementation
    );

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
    response.cookie('refreshToken', newToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

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
}
