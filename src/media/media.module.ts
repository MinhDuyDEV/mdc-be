import { Module } from '@nestjs/common';
import { InfraModule } from '../infra/infra.module';
import { OutboxModule } from '../outbox';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaCleanupService } from './media-cleanup.service';

@Module({
  imports: [InfraModule, OutboxModule],
  controllers: [MediaController],
  providers: [MediaService, MediaCleanupService],
  exports: [MediaService],
})
export class MediaModule {}
