import { Module } from "@nestjs/common";
import { InfraModule } from "../infra/infra.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
	imports: [InfraModule],
	controllers: [MediaController],
	providers: [MediaService],
	exports: [MediaService],
})
export class MediaModule {}
