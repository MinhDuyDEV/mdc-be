import { Module } from "@nestjs/common";
import { InfraModule } from "../infra/infra.module";
import { OutboxModule } from "../outbox";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
	imports: [InfraModule, OutboxModule],
	controllers: [ProfilesController],
	providers: [ProfilesService],
	exports: [ProfilesService],
})
export class ProfilesModule {}
