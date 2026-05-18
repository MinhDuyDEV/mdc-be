import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Post,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import type { ConfirmUploadDto } from "./dto/confirm-upload.dto";
import type { InitiateUploadDto } from "./dto/initiate-upload.dto";
import { MediaService } from "./media.service";

@Controller("media")
export class MediaController {
	constructor(private readonly mediaService: MediaService) {}

	@Post("initiate")
	@HttpCode(HttpStatus.OK)
	async initiateUpload(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: InitiateUploadDto,
	) {
		return this.mediaService.initiateUpload(user, dto);
	}

	@Post(":id/confirm")
	@HttpCode(HttpStatus.OK)
	async confirmUpload(
		@CurrentUser() user: AuthenticatedUser,
		@Param('id') id: string,
		@Body() _dto: ConfirmUploadDto,
	) {
		return this.mediaService.confirmUpload(user, id);
	}
}
