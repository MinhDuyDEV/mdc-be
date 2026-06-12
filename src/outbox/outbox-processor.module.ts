import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { InfraModule } from '../infra';
import { PushModule } from '../infra/push/push.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SearchModule } from '../search';
import { OutboxCoreModule } from './outbox-core.module';
import { OutboxMetrics } from './outbox.metrics';
import { OutboxProcessor } from './outbox.processor';
import { ApplicationEmailProcessor } from './processors/application-email.processor';
import { BillingProcessor } from './processors/billing.processor';
import { CompanySearchIndexProcessor } from './processors/company-search-index.processor';
import { JobAlertProcessor } from './processors/job-alert.processor';
import { JobSearchIndexProcessor } from './processors/job-search-index.processor';
import { MessagingProcessor } from './processors/messaging.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { PostInteractionProcessor } from './processors/post-interaction.processor';
import { PostSearchIndexProcessor } from './processors/post-search-index.processor';
import { ProfileCreationProcessor } from './processors/profile-creation.processor';
import { ProfileSearchIndexProcessor } from './processors/profile-search-index.processor';
import { ExperimentTrackingProcessor } from './processors/experiment-tracking.processor';
import { PushNotificationProcessor } from './processors/push-notification.processor';
import { RecruitingProcessor } from './processors/recruiting.processor';
import { SubscriptionProcessor } from './processors/subscription.processor';

@Module({
  imports: [
    InfraModule,
    OutboxCoreModule,
    RealtimeModule,
    SearchModule,
    EmailModule,
    PushModule,
  ],
  providers: [
    ExperimentTrackingProcessor,
    NotificationProcessor,
    PostInteractionProcessor,
    PostSearchIndexProcessor,
    OutboxMetrics,
    OutboxProcessor,
    ProfileCreationProcessor,
    ProfileSearchIndexProcessor,
    CompanySearchIndexProcessor,
    JobAlertProcessor,
    JobSearchIndexProcessor,
    MessagingProcessor,
    PushNotificationProcessor,
    ApplicationEmailProcessor,
    BillingProcessor,
    SubscriptionProcessor,
    RecruitingProcessor,
  ],
})
export class OutboxProcessorModule {}
