import { Module } from "@nestjs/common";
import { InfraModule } from "../infra";
import { DeadLetterService } from "./dead-letter.service";
import { IdempotencyService } from "./idempotency.service";
import { OutboxProcessor } from "./outbox.processor";
import { OutboxService } from "./outbox.service";
import { ApplicationEmailProcessor } from "./processors/application-email.processor";
import { CompanySearchIndexProcessor } from "./processors/company-search-index.processor";
import { JobSearchIndexProcessor } from "./processors/job-search-index.processor";
import { NotificationProcessor } from "./processors/notification.processor";
import { PostInteractionProcessor } from "./processors/post-interaction.processor";
import { ProfileCreationProcessor } from "./processors/profile-creation.processor";
import { ProfileSearchIndexProcessor } from "./processors/profile-search-index.processor";

@Module({
	imports: [InfraModule],
	providers: [
		DeadLetterService,
		IdempotencyService,
		NotificationProcessor,
		PostInteractionProcessor,
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
