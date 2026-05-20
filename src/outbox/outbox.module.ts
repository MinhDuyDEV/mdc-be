import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { DeadLetterService } from './dead-letter.service';
import { IdempotencyService } from './idempotency.service';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';
import { ApplicationEmailProcessor } from './processors/application-email.processor';
import { CompanySearchIndexProcessor } from './processors/company-search-index.processor';
import { JobSearchIndexProcessor } from './processors/job-search-index.processor';
import { ProfileCreationProcessor } from './processors/profile-creation.processor';
import { ProfileSearchIndexProcessor } from './processors/profile-search-index.processor';

@Module({
  imports: [InfraModule],
  providers: [
    DeadLetterService,
    IdempotencyService,
    OutboxProcessor,
    OutboxService,
    ProfileCreationProcessor,
    ProfileSearchIndexProcessor,
    CompanySearchIndexProcessor,
    JobSearchIndexProcessor,
    ApplicationEmailProcessor,
  ],
  exports: [DeadLetterService, IdempotencyService, OutboxService],
})
export class OutboxModule {}
