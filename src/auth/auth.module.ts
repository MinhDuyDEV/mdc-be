import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { AppConfig } from "../infra/config/app-config";
import { InfraModule } from "../infra/infra.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordResetService } from "./password-reset.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get("jwtAccessSecret", { infer: true }),
        signOptions: {
          expiresIn: config.get("jwtAccessExpiresIn", { infer: true }),
        },
      }),
    }),
    InfraModule,
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    EmailVerificationService,
    PasswordResetService,
    AuthService,
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
