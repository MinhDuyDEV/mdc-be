import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin';
import { AnalyticsModule } from './analytics';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CommonModule } from './common';
import { CompaniesModule } from './companies/companies.module';
import { ConnectionsModule } from './connections/connections.module';
import { EmailModule } from './email/email.module';
import { FeedModule } from './feed/feed.module';
import { InfraModule } from './infra';
import type { AppConfig } from './infra/config';
import { REDIS_CLIENT } from './infra/redis/redis.constants';
import { JobsModule } from './jobs/jobs.module';
import { MediaModule } from './media/media.module';
import { MessagingModule } from './messaging/messaging.module';
import { ModerationModule } from './moderation';
import { NotificationsModule } from './notifications/notifications.module';
import { OutboxModule } from './outbox';
import { PostsModule } from './posts/posts.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RecommendationsModule } from './recommendations';
import { RecruitingModule } from './recruiting/recruiting.module';
import { SearchModule } from './search';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [InfraModule],
      inject: [REDIS_CLIENT],
      useFactory: (redisClient: import('ioredis').Redis) => ({
        throttlers: [{ limit: 10, ttl: 60000 }],
        storage: new ThrottlerStorageRedisService(redisClient),
      }),
    }),
    ScheduleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const role = config.get('appProcessRole', { infer: true });
        const isWorker = role === 'worker' || role === 'all';
        return {
          cronJobs: isWorker,
          intervals: isWorker,
          timeouts: false,
        };
      },
    }),
    AdminModule,
    CommonModule,
    InfraModule,
    AnalyticsModule,
    ApplicationsModule,
    AuthModule,
    BillingModule,
    CompaniesModule,
    EmailModule,
    JobsModule,
    MediaModule,
    NotificationsModule,
    OutboxModule,
    PostsModule,
    ProfilesModule,
    RecommendationsModule,
    FeedModule,
    ConnectionsModule,
    MessagingModule,
    ModerationModule,
    RecruitingModule,
    RealtimeModule,
    SearchModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
