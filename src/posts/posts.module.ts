import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { InfraModule } from '../infra/infra.module';
import { OutboxCoreModule } from '../outbox/outbox-core.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostsPolicyService } from './posts-policy.service';

@Module({
  imports: [InfraModule, OutboxCoreModule, ConnectionsModule],
  controllers: [PostsController],
  providers: [PostsService, PostsPolicyService],
  exports: [PostsService, PostsPolicyService],
})
export class PostsModule {}
