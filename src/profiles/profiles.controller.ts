import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Query,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import type { SearchProfilesDto } from "./dto/search-profiles.dto";
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

	@Get('search')
  @HttpCode(HttpStatus.OK)
  async searchProfiles(@Query() dto: SearchProfilesDto) {
    return this.profilesService.searchProfiles(dto.q, dto.limit, dto.offset);
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
