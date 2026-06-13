import { Module } from '@nestjs/common';
import * as sharp from 'sharp';
import { InfraModule } from '../infra/infra.module';
import { OutboxCoreModule } from '../outbox';
import { ImageProcessingService, SHARP } from './image-processing.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaCleanupService } from './media-cleanup.service';
import { VirusScanService } from './virus-scan.service';

@Module({
  imports: [InfraModule, OutboxCoreModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaCleanupService,
    // Phase E T2: opt-in services. The PompelmiService (from
    // @pompelmi/nestjs) is registered as a separate module only when
    // the operator enables virus scanning; this module just provides
    // the wrappers. Same pattern for image processing.
    VirusScanService,
    ImageProcessingService,
    { provide: SHARP, useValue: sharp },
  ],
  exports: [MediaService, VirusScanService, ImageProcessingService],
})
export class MediaModule {}
