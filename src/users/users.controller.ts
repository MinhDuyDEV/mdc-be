import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { ProfilesService } from '../profiles/profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
  ) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getOwnProfile(user);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateOwnProfile(user, dto);
  }

  /**
   * Public user lookup — delegates to ProfilesService for the canonical
   * public-profile response (with visibility filtering). Users without a
   * profile will 404 here, which is the expected behavior for a profile-aware
   * public endpoint.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser | undefined,
  ) {
    return this.profilesService.getPublicProfile(id, currentUser);
  }
}
