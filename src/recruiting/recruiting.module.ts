import { forwardRef, Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { InfraModule } from '../infra';
import { OutboxModule } from '../outbox';
import { RecruitingController } from './recruiting.controller';
import { RecruitingService } from './recruiting.service';
import { RecruitingPolicyService } from './recruiting-policy.service';

@Module({
  imports: [InfraModule, forwardRef(() => OutboxModule), ConnectionsModule],
  controllers: [RecruitingController],
  providers: [RecruitingService, RecruitingPolicyService],
  exports: [RecruitingService, RecruitingPolicyService],
})
export class RecruitingModule {}
