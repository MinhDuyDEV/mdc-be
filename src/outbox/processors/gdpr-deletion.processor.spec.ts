import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../../analytics/analytics.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { SearchIndexService } from '../../search/search-index.service';
import { GdprDeletionProcessor } from './gdpr-deletion.processor';

describe('GdprDeletionProcessor', () => {
  let processor: GdprDeletionProcessor;
  let realtimeGateway: { disconnectUser: jest.Mock };
  let searchIndex: { deleteByUser: jest.Mock };
  let analyticsService: { anonymizeForUser: jest.Mock };

  const payload = {
    userId: 'user-1',
    requestId: 'req-1',
    deletedBy: 'user-1',
    reason: 'user-request',
    deletedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    realtimeGateway = {
      disconnectUser: jest.fn().mockResolvedValue(undefined),
    };
    searchIndex = { deleteByUser: jest.fn().mockResolvedValue(undefined) };
    analyticsService = {
      anonymizeForUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprDeletionProcessor,
        { provide: RealtimeGateway, useValue: realtimeGateway },
        { provide: SearchIndexService, useValue: searchIndex },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    processor = module.get<GdprDeletionProcessor>(GdprDeletionProcessor);
  });

  it('is defined', () => {
    expect(processor).toBeDefined();
  });

  it('calls disconnect, then search delete, then analytics anonymize in order', async () => {
    const order: string[] = [];
    realtimeGateway.disconnectUser.mockImplementation(async () => {
      order.push('realtime');
    });
    searchIndex.deleteByUser.mockImplementation(async () => {
      order.push('search');
    });
    analyticsService.anonymizeForUser.mockImplementation(async () => {
      order.push('analytics');
    });

    await processor.processUserDataDeleted(payload);

    expect(order).toEqual(['realtime', 'search', 'analytics']);
    expect(realtimeGateway.disconnectUser).toHaveBeenCalledWith('user-1');
    expect(searchIndex.deleteByUser).toHaveBeenCalledWith('user-1');
    expect(analyticsService.anonymizeForUser).toHaveBeenCalledWith('user-1');
  });

  it('propagates realtime errors so outbox retries the event', async () => {
    realtimeGateway.disconnectUser.mockRejectedValue(new Error('ws down'));
    await expect(processor.processUserDataDeleted(payload)).rejects.toThrow(
      'ws down',
    );
  });
});
