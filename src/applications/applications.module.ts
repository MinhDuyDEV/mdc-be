import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { MediaModule } from '../media/media.module';
import { OutboxCoreModule } from '../outbox';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [InfraModule, MediaModule, OutboxCoreModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
