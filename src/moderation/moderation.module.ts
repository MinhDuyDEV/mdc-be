import { Module } from '@nestjs/common';
import { InfraModule } from '../infra/infra.module';
import { OutboxModule } from '../outbox/outbox.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ModerationPolicyService } from './moderation-policy.service';

@Module({
  imports: [InfraModule, OutboxModule],
  controllers: [ModerationController],
  providers: [ModerationService, ModerationPolicyService],
  exports: [ModerationService],
})
export class ModerationModule {}
