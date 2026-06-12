import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { NotificationPreferenceController } from './notification-preference.controller';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [InfraModule],
  controllers: [
    NotificationsController,
    NotificationPreferenceController,
    DevicesController,
  ],
  providers: [
    NotificationsService,
    NotificationPreferenceService,
    DevicesService,
  ],
  exports: [NotificationsService, DevicesService],
})
export class NotificationsModule {}
