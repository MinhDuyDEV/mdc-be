import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import { Public } from "../common/auth/public.decorator";
import type { SearchProfilesDto } from "./dto/search-profiles.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { ProfilesService } from "./profiles.service";

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
  @Public()
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

	@Post(":userId/skills/:skillId/endorse")
	@HttpCode(HttpStatus.CREATED)
	async endorseSkill(
		@CurrentUser() endorser: AuthenticatedUser,
		@Param('skillId') skillId: string,
	) {
		return this.profilesService.endorseSkill(skillId, endorser);
	}

	@Delete(":userId/skills/:skillId/endorse")
	@HttpCode(HttpStatus.OK)
	async removeEndorsement(
		@CurrentUser() endorser: AuthenticatedUser,
		@Param('skillId') skillId: string,
	) {
		return this.profilesService.removeEndorsement(skillId, endorser);
	}
}
