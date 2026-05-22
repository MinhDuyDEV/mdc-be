import { Module } from "@nestjs/common";
import { InfraModule } from "../infra";
import { OutboxModule } from "../outbox";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({
	imports: [InfraModule, OutboxModule],
	controllers: [BillingController],
	providers: [BillingService],
	exports: [BillingService],
})
export class BillingModule {}
