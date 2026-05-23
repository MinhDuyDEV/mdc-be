import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { OutboxCoreModule } from '../outbox';
import {
  ConnectionsController,
  ConnectionsUsersController,
} from './connections.controller';
import { ConnectionsService } from './connections.service';
import { ConnectionsPolicyService } from './connections-policy.service';

@Module({
  imports: [InfraModule, OutboxCoreModule],
  controllers: [ConnectionsController, ConnectionsUsersController],
  providers: [ConnectionsService, ConnectionsPolicyService],
  exports: [ConnectionsService, ConnectionsPolicyService],
})
export class ConnectionsModule {}
