import { Module } from '@nestjs/common';
import { PolicyGuard } from './guards/policy.guard';

@Module({
  providers: [PolicyGuard],
  exports: [PolicyGuard],
})
export class CommonModule {}
