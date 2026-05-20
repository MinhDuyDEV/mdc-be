import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { OutboxModule } from '../outbox';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { ConnectionsPolicyService } from './connections-policy.service';

@Module({
  imports: [InfraModule, OutboxModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, ConnectionsPolicyService],
  exports: [ConnectionsService, ConnectionsPolicyService],
})
export class ConnectionsModule {}
