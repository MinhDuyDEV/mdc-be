import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import * as archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

import type { AppConfig } from '../infra/config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { STORAGE_CLIENT } from '../infra/storage/storage.constants';
import { Inject } from '@nestjs/common';
import type { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from '../infra/storage/storage.service';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(STORAGE_CLIENT) private readonly s3: S3Client,
  ) {}

  async exportUserData(
    userId: string,
    exportId: string,
  ): Promise<{ s3Key: string; downloadUrl: string; expiresAt: string }> {
    // Fetch all user data in parallel
    const [
      user,
      profile,
      experiences,
      educations,
      certifications,
      posts,
      messages,
      connections,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.profile.findFirst({ where: { userId, deletedAt: null } }),
      this.prisma.experience.findMany({
        where: { profile: { userId }, deletedAt: null },
      }),
      this.prisma.education.findMany({
        where: { profile: { userId }, deletedAt: null },
      }),
      this.prisma.certification.findMany({
        where: { profile: { userId }, deletedAt: null },
      }),
      this.prisma.post.findMany({
        where: { authorId: userId, deletedAt: null },
      }),
      this.prisma.message.findMany({
        where: { senderId: userId, deletedAt: null },
      }),
      this.prisma.connection.findMany({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
          deletedAt: null,
        },
      }),
    ]);

    const exportData = {
      exportId,
      userId,
      exportedAt: new Date().toISOString(),
      user: user ? this.scrubPii(user) : null,
      profile,
      experiences,
      educations,
      certifications,
      posts,
      messages,
      connections,
    };

    const json = JSON.stringify(exportData, null, 2);

    // Retention config
    const retentionDays = this.configService.get('gdprExportRetentionDays', {
      infer: true,
    });
    const s3Key = `gdpr-exports/${userId}/${exportId}.zip`;
    const expiresAt = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    );

    // Stream ZIP directly to S3 — no full in-memory buffer
    const zipStream = this.createZipStream(json);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: 'gdpr-exports',
        Key: s3Key,
        Body: zipStream,
        ContentType: 'application/zip',
      }),
    );

    const downloadUrl = await this.storage.generatePresignedDownloadUrl(
      'gdpr-exports',
      s3Key,
      retentionDays * 24 * 60 * 60,
    );

    return { s3Key, downloadUrl, expiresAt: expiresAt.toISOString() };
  }

  private scrubPii(user: {
    id: string;
    email: string;
    displayName?: string | null;
    createdAt: Date;
  }): Record<string, unknown> {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  /**
   * Creates a Readable stream that yields a ZIP archive containing data.json.
   * The archive is streamed directly rather than buffered in memory.
   */
  private createZipStream(json: string): Readable {
    const archive = archiver.create('zip', { zlib: { level: 9 } });
    const passThrough = new PassThrough();

    archive.append(json, { name: 'data.json' });
    archive.pipe(passThrough);

    // Forward archiver errors to the stream so PutObjectCommand rejects properly
    archive.on('error', (err: Error) => passThrough.destroy(err));

    void archive.finalize();

    return passThrough;
  }
}
