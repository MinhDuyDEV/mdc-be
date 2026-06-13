import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

import type { AppConfig } from '../infra/config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { StorageService } from '../infra/storage/storage.service';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService<AppConfig, true>,
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

    // Build ZIP
    const zip = await this.createZip(json);

    // Upload to S3 with configurable retention
    const retentionDays = this.configService.get('gdprExportRetentionDays', {
      infer: true,
    });
    const s3Key = `gdpr-exports/${userId}/${exportId}.zip`;
    const expiresAt = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    );

    await this.storage.putObject('gdpr-exports', s3Key, zip, {
      contentType: 'application/zip',
    });

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

  private async createZip(json: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver.create('zip', { zlib: { level: 9 } });
      const buffers: Buffer[] = [];
      const passThrough = new PassThrough();

      archive.append(json, { name: 'data.json' });
      archive.pipe(passThrough);

      passThrough.on('data', (chunk: Buffer) => buffers.push(chunk));
      passThrough.on('end', () => resolve(Buffer.concat(buffers)));
      passThrough.on('error', (err: Error) => reject(err));

      void archive.finalize();
    });
  }
}
