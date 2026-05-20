import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { InfraModule } from '../infra/infra.module';
import { PostsModule } from '../posts/posts.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [InfraModule, PostsModule, ConnectionsModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
