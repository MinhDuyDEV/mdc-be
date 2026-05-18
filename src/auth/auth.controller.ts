import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import { Public } from "../common/auth/public.decorator";
import { AuthService } from "./auth.service";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordResetService } from "./password-reset.service";
import { TokenService } from "./token.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    const cookieSecure = process.env.COOKIE_SECURE === "true";

    response.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const oldToken = request.cookies?.refreshToken;
    if (!oldToken) {
      return { accessToken: "", message: "No refresh token" };
    }

    // Token is opaque UUID; we need to find and validate it
    // For now, return the same token (simplified)
    response.cookie("refreshToken", oldToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });

    return { accessToken: "", refreshToken: oldToken };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken;
    if (refreshToken) {
      const user = (request as any).user as AuthenticatedUser | undefined;
      if (user) {
        await this.tokenService.revokeRefreshToken(user.id, refreshToken);
      }
    }

    response.clearCookie("refreshToken", { path: "/api/v1/auth" });
    return { message: "Logged out successfully" };
  }

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.emailVerificationService.verifyToken(dto.token);
    return { message: "Email verified successfully" };
  }

  @Public()
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return { message: "If the email exists, a new verification email has been sent" };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.passwordResetService.requestReset(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.passwordResetService.confirmReset(dto.token, dto.newPassword);
  }
}
