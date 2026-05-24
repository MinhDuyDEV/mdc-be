import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { PolicyGuard } from './guards/policy.guard';
import { IdempotencyKeyInterceptor } from './idempotency';

@Module({
  imports: [InfraModule],
  providers: [EmailVerifiedGuard, PolicyGuard, IdempotencyKeyInterceptor],
  exports: [EmailVerifiedGuard, PolicyGuard, IdempotencyKeyInterceptor],
})
export class CommonModule {}
