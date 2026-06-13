import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { ConnectionsModule } from '../connections/connections.module';
import { InfraModule } from '../infra';
import { MessagingModule } from '../messaging/messaging.module';
import { OutboxCoreModule } from '../outbox/outbox-core.module';
import { PostsModule } from '../posts/posts.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SearchModule } from '../search';
import { DataExportService } from './data-export.service';
import { DeletionRequestService } from './deletion-request.service';
import { GdprController } from './gdpr.controller';
import { GdprGraceExpiryProcessor } from './gdpr-grace-expiry.processor';
import { GdprService } from './gdpr.service';
import { GdprSlaMonitorService } from './gdpr-sla-monitor.service';

@Module({
  imports: [
    InfraModule,
    OutboxCoreModule,
    AuthModule,
    ConnectionsModule,
    PostsModule,
    MessagingModule,
    AnalyticsModule,
    SearchModule,
    RealtimeModule,
  ],
  controllers: [GdprController],
  providers: [
    GdprService,
    DeletionRequestService,
    DataExportService,
    GdprSlaMonitorService,
    GdprGraceExpiryProcessor,
  ],
  exports: [GdprService, DeletionRequestService],
})
export class GdprModule {}
