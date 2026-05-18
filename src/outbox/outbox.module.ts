import { Module } from "@nestjs/common";
import { OutboxProcessor } from "./outbox.processor";
import { OutboxService } from "./outbox.service";

@Module({
	imports: [],
	providers: [OutboxService, OutboxProcessor],
	exports: [OutboxService],
})
export class OutboxModule {}
