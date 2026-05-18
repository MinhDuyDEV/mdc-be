import { Module } from "@nestjs/common";
import { IdempotencyService } from "./idempotency.service";
import { OutboxProcessor } from "./outbox.processor";
import { OutboxService } from "./outbox.service";

@Module({
	imports: [],
	providers: [OutboxService, OutboxProcessor, IdempotencyService],
	exports: [OutboxService, IdempotencyService],
})
export class OutboxModule {}
