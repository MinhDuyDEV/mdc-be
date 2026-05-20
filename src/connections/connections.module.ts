import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { ConnectionsPolicyService } from './connections-policy.service';

@Module({
  controllers: [ConnectionsController],
  providers: [ConnectionsService, ConnectionsPolicyService],
  exports: [ConnectionsService, ConnectionsPolicyService],
})
export class ConnectionsModule {}
