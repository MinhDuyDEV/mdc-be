import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { PolicyGuard } from './guards/policy.guard';

@Module({
  imports: [InfraModule],
  providers: [EmailVerifiedGuard, PolicyGuard],
  exports: [EmailVerifiedGuard, PolicyGuard],
})
export class CommonModule {}
