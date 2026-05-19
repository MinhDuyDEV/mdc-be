import { Module } from "@nestjs/common";
import { InfraModule } from "../infra";
import { OutboxModule } from "../outbox";
import { RecruitingController } from "./recruiting.controller";
import { RecruitingService } from "./recruiting.service";
import { RecruitingPolicyService } from "./recruiting-policy.service";

@Module({
	imports: [InfraModule, OutboxModule],
	controllers: [RecruitingController],
	providers: [RecruitingService, RecruitingPolicyService],
	exports: [RecruitingService, RecruitingPolicyService],
})
export class RecruitingModule {}
