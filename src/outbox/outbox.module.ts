import { forwardRef, Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { RealtimeModule } from '../realtime/realtime.module';
import { SearchModule } from '../search';
import { DeadLetterService } from './dead-letter.service';
import { IdempotencyService } from './idempotency.service';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';
import { ApplicationEmailProcessor } from './processors/application-email.processor';
import { CompanySearchIndexProcessor } from './processors/company-search-index.processor';
import { JobSearchIndexProcessor } from './processors/job-search-index.processor';
import { MessagingProcessor } from './processors/messaging.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { PostInteractionProcessor } from './processors/post-interaction.processor';
import { PostSearchIndexProcessor } from './processors/post-search-index.processor';
import { ProfileCreationProcessor } from './processors/profile-creation.processor';
import { ProfileSearchIndexProcessor } from './processors/profile-search-index.processor';

@Module({
  imports: [InfraModule, forwardRef(() => RealtimeModule), SearchModule],
  providers: [
    DeadLetterService,
    IdempotencyService,
    NotificationProcessor,
    PostInteractionProcessor,
    PostSearchIndexProcessor,
    OutboxProcessor,
    OutboxService,
    ProfileCreationProcessor,
    ProfileSearchIndexProcessor,
    CompanySearchIndexProcessor,
    JobSearchIndexProcessor,
    MessagingProcessor,
    ApplicationEmailProcessor,
  ],
  exports: [DeadLetterService, IdempotencyService, OutboxService],
})
export class OutboxModule {}
