import { Module } from '@nestjs/common';
import { InfraModule } from '../infra/infra.module';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailTrackingService } from './email-tracking.service';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

@Module({
  imports: [InfraModule],
  controllers: [EmailTrackingController],
  providers: [EmailService, EmailProcessor, EmailTrackingService],
  exports: [EmailService, EmailTrackingService],
})
export class EmailModule {}
