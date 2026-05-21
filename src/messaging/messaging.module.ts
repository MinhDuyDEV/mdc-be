import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { InfraModule } from '../infra/infra.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RecruitingModule } from '../recruiting/recruiting.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagingPolicyService } from './messaging-policy.service';

@Module({
  imports: [InfraModule, OutboxModule, ConnectionsModule, RecruitingModule],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingPolicyService],
  exports: [MessagingService, MessagingPolicyService],
})
export class MessagingModule {}
