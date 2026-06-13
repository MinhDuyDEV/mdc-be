import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../../observability/metrics.service';

/**
 * Handles notification-side effects for media scan + thumbnail events.
 * These events are not used to mutate the MediaAsset row (that has
 * already been persisted by the producing service) — they exist so
 * downstream consumers (notifications, search, analytics) can react
 * asynchronously.
 */
@Injectable()
export class MediaScanProcessor {
  private readonly logger = new Logger(MediaScanProcessor.name);

  constructor(private readonly metricsService: MetricsService) {}

  onVirusScanned(payload: {
    mediaAssetId: string;
    ownerId: string;
    clean: boolean;
    threats?: string[];
  }): void {
    this.metricsService.recordMediaUpload(
      'unknown',
      payload.clean ? 'ready' : 'quarantined',
    );
    if (!payload.clean) {
      this.logger.warn(
        `Media ${payload.mediaAssetId} infected: ${(payload.threats ?? []).join(', ')}`,
      );
    }
  }

  onThumbnailsGenerated(payload: {
    mediaAssetId: string;
    ownerId: string;
    sizes: Array<{ width: number; s3Key: string }>;
  }): void {
    this.logger.log(
      `Generated ${payload.sizes.length} thumbnails for ${payload.mediaAssetId}`,
    );
  }
}
