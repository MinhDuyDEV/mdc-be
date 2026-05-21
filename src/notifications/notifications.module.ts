import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { NotificationPreferenceController } from './notification-preference.controller';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [InfraModule],
  controllers: [NotificationsController, NotificationPreferenceController],
  providers: [NotificationsService, NotificationPreferenceService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
