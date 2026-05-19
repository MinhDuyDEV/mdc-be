import { Module } from "@nestjs/common";
import { InfraModule } from "../infra";
import { OutboxModule } from "../outbox";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";

@Module({
	imports: [InfraModule, OutboxModule],
	controllers: [CompaniesController],
	providers: [CompaniesService],
	exports: [CompaniesService],
})
export class CompaniesModule {}
