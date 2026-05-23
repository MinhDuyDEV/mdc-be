import { Module } from '@nestjs/common';
import { InfraModule } from '../infra/infra.module';
import { OutboxCoreModule } from '../outbox';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaCleanupService } from './media-cleanup.service';

@Module({
  imports: [InfraModule, OutboxCoreModule],
  controllers: [MediaController],
  providers: [MediaService, MediaCleanupService],
  exports: [MediaService],
})
export class MediaModule {}
