import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../../analytics/analytics.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { SearchIndexService } from '../../search/search-index.service';

/**
 * Async cascade handler for `UserDataDeleted` events. Performs the
 * post-anonymization side effects that are not safe to run inside the
 * primary GDPR transaction (external services, search index, analytics).
 *
 * Note: realtime disconnect and session revocation are also attempted
 * inside `anonymizeUser` (post-commit) for defense in depth; this processor
 * is the durable async path that survives a worker crash.
 */
@Injectable()
export class GdprDeletionProcessor {
  constructor(
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
    // Order matters: disconnect realtime first (so the user doesn't see
    // further events), then drop from search index, then anonymize analytics.
    await this.realtimeGateway.disconnectUser(payload.userId);
    await this.searchIndex.deleteByUser(payload.userId);
    await this.analyticsService.anonymizeForUser(payload.userId);
  }
}
