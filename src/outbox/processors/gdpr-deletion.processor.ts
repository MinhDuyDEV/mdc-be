import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../../analytics/analytics.service';
import { GdprService } from '../../gdpr/gdpr.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { SearchIndexService } from '../../search/search-index.service';

@Injectable()
export class GdprDeletionProcessor {
  constructor(
    private readonly gdprService: GdprService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly searchIndex: SearchIndexService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async processUserDataDeleted(payload: {
    userId: string;
    requestId: string;
    deletedBy: string;
    reason?: string;
    deletedAt: string;
  }): Promise<void> {
    // Disconnect realtime sockets
    await this.realtimeGateway.disconnectUser(payload.userId);
    // Delete from search index
    await this.searchIndex.deleteByUser(payload.userId);
    // Anonymize analytics events
    await this.analyticsService.anonymizeForUser(payload.userId);
  }
}
