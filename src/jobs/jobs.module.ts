import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { InfraModule } from "../infra";
import { OutboxModule } from "../outbox";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";

@Module({
	imports: [BillingModule, InfraModule, OutboxModule],
	controllers: [JobsController],
	providers: [JobsService],
	exports: [JobsService],
})
export class JobsModule {}
