import { Module } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { PolicyGuard } from './guards/policy.guard';

@Module({
  providers: [AuthGuard, PolicyGuard],
  exports: [AuthGuard, PolicyGuard],
})
export class CommonModule {}
