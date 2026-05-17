import { Module } from "@nestjs/common";
import { OutboxService } from "./outbox.service";

@Module({
	imports: [],
	providers: [OutboxService],
	exports: [OutboxService],
})
export class OutboxModule {}
