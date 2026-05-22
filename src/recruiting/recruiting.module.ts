import { forwardRef, Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ConnectionsModule } from '../connections/connections.module';
import { InfraModule } from '../infra';
import { OutboxModule } from '../outbox';
import { RecruitingController } from './recruiting.controller';
import { RecruitingService } from './recruiting.service';
import { RecruitingPolicyService } from './recruiting-policy.service';

@Module({
  imports: [
    InfraModule,
    forwardRef(() => OutboxModule),
    ConnectionsModule,
    BillingModule,
  ],
  controllers: [RecruitingController],
  providers: [RecruitingService, RecruitingPolicyService],
  exports: [RecruitingService, RecruitingPolicyService],
})
export class RecruitingModule {}
