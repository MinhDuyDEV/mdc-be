import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfilesService } from "./profiles.service";

@Controller("profiles")
export class ProfilesController {
	constructor(private readonly profilesService: ProfilesService) {}

	@Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getOwnProfile(user);
  }

	@Patch("me")
	@HttpCode(HttpStatus.OK)
	async updateMe(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: UpdateProfileDto,
	) {
		return this.profilesService.updateOwnProfile(user, dto);
	}

	@Get(":userId")
	@HttpCode(HttpStatus.OK)
	async getProfile(
		@Param('userId') userId: string,
		@CurrentUser() user: AuthenticatedUser | undefined,
	) {
		return this.profilesService.getPublicProfile(userId, user ?? undefined);
	}
}
