import { Test, TestingModule } from '@nestjs/testing';
import { DataExportService } from '../../gdpr/data-export.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OutboxService } from '../outbox.service';
import { GdprExportProcessor } from './gdpr-export.processor';

describe('GdprExportProcessor', () => {
  let processor: GdprExportProcessor;
  let dataExportService: { exportUserData: jest.Mock };
  let outboxService: { emit: jest.Mock };
  let prismaTx: unknown;

  const payload = {
    exportId: 'export-1',
    userId: 'user-1',
    requestedBy: 'user-1',
    requestedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    dataExportService = {
      exportUserData: jest.fn().mockResolvedValue({
        s3Key: 'exports/user-1/export-1.zip',
        downloadUrl: 'https://signed.example.com/...',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    };
    outboxService = { emit: jest.fn().mockResolvedValue(undefined) };
    prismaTx = { outbox: outboxService };

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
          await cb(prismaTx);
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprExportProcessor,
        { provide: DataExportService, useValue: dataExportService },
        { provide: OutboxService, useValue: outboxService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get<GdprExportProcessor>(GdprExportProcessor);
  });

  it('is defined', () => {
    expect(processor).toBeDefined();
  });

  it('generates the export, then emits UserDataExported inside a transaction', async () => {
    await processor.processUserDataExportRequested(payload);

    expect(dataExportService.exportUserData).toHaveBeenCalledWith(
      'user-1',
      'export-1',
    );
    expect(outboxService.emit).toHaveBeenCalledTimes(1);
    const [tx, event] = outboxService.emit.mock.calls[0];
    expect(tx).toBe(prismaTx);
    expect(event).toMatchObject({
      eventType: 'UserDataExported',
      aggregateType: 'User',
      aggregateId: 'user-1',
    });
    expect(event.payload).toMatchObject({
      exportId: 'export-1',
      userId: 'user-1',
      s3Bucket: 'gdpr-exports',
      s3Key: 'exports/user-1/export-1.zip',
    });
  });

  it('propagates export service errors so outbox retries', async () => {
    dataExportService.exportUserData.mockRejectedValue(new Error('s3 down'));
    await expect(
      processor.processUserDataExportRequested(payload),
    ).rejects.toThrow('s3 down');
  });
});
