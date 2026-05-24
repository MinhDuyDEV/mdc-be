import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationPreferenceService } from './notification-preference.service';

@Controller('notifications/preferences')
@UseGuards(AuthGuard)
export class NotificationPreferenceController {
  constructor(
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  @Get()
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferenceService.getPreferences(user.id);
  }

  @Put()
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferenceService.updatePreferences(user.id, dto);
  }
}
