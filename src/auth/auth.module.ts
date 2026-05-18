import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../infra/config/app-config';
import { InfraModule } from '../infra/infra.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwtAccessSecret', { infer: true }),
        signOptions: {
          expiresIn: config.get('jwtAccessExpiresIn', { infer: true }),
        },
      }),
    }),
    InfraModule,
    OutboxModule,
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    EmailVerificationService,
    PasswordResetService,
    AuthService,
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
  exports: [AuthService, TokenService, AuthGuard],
})
export class AuthModule {}
