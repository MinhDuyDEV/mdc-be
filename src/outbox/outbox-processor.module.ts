import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { RealtimeModule } from '../realtime/realtime.module';
import { SearchModule } from '../search';
import { OutboxCoreModule } from './outbox-core.module';
import { OutboxProcessor } from './outbox.processor';
import { ApplicationEmailProcessor } from './processors/application-email.processor';
import { BillingProcessor } from './processors/billing.processor';
import { CompanySearchIndexProcessor } from './processors/company-search-index.processor';
import { JobSearchIndexProcessor } from './processors/job-search-index.processor';
import { MessagingProcessor } from './processors/messaging.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { PostInteractionProcessor } from './processors/post-interaction.processor';
import { PostSearchIndexProcessor } from './processors/post-search-index.processor';
import { ProfileCreationProcessor } from './processors/profile-creation.processor';
import { ProfileSearchIndexProcessor } from './processors/profile-search-index.processor';
import { SubscriptionProcessor } from './processors/subscription.processor';

@Module({
  imports: [InfraModule, OutboxCoreModule, RealtimeModule, SearchModule],
  providers: [
    NotificationProcessor,
    PostInteractionProcessor,
    PostSearchIndexProcessor,
    OutboxProcessor,
    ProfileCreationProcessor,
    ProfileSearchIndexProcessor,
    CompanySearchIndexProcessor,
    JobSearchIndexProcessor,
    MessagingProcessor,
    ApplicationEmailProcessor,
    BillingProcessor,
    SubscriptionProcessor,
  ],
})
export class OutboxProcessorModule {}
