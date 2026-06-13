import { Injectable } from '@nestjs/common';
import { DataExportService } from '../../gdpr/data-export.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OutboxService } from '../outbox.service';

@Injectable()
export class GdprExportProcessor {
  constructor(
    private readonly dataExportService: DataExportService,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  async processUserDataExportRequested(payload: {
    exportId: string;
    userId: string;
    requestedBy: string;
    requestedAt: string;
  }): Promise<void> {
    const { s3Key, downloadUrl, expiresAt } =
      await this.dataExportService.exportUserData(
        payload.userId,
        payload.exportId,
      );

    await this.prisma.$transaction(async (tx) => {
      await this.outboxService.emit(tx, {
        eventType: 'UserDataExported',
        aggregateType: 'User',
        aggregateId: payload.userId,
        payload: {
          exportId: payload.exportId,
          userId: payload.userId,
          s3Bucket: 'gdpr-exports',
          s3Key,
          downloadUrl,
          expiresAt,
          exportedAt: new Date().toISOString(),
        },
      });
    });
  }
}
