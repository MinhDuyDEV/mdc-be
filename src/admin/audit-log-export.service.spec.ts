import { Readable } from 'node:stream';
import { AuditLogExportService } from './audit-log-export.service';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';

interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Creates a Prisma mock where findMany returns the given rows on the
 * first call and empty on subsequent calls. This simulates cursor-based
 * pagination reaching the end of the dataset after the initial fetch.
 */
function buildPrisma(rows: AuditLogRow[]): {
  auditLog: { findMany: jest.Mock; findFirst: jest.Mock };
} {
  let calls = 0;
  const findMany = jest.fn().mockImplementation(async () => {
    calls++;
    return calls === 1 ? rows : [];
  });
  const findFirst = jest.fn().mockImplementation(async () => rows[0] ?? null);
  return { auditLog: { findMany, findFirst } };
}

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

describe('AuditLogExportService', () => {
  describe('exportCsv', () => {
    it('emits header row and CSV-encoded rows', async () => {
      const rows: AuditLogRow[] = [
        {
          id: 'a1',
          actorUserId: 'u1',
          action: 'admin.user.status_change',
          entityType: 'user',
          entityId: 'u2',
          ip: '127.0.0.1',
          userAgent: 'curl/8.0',
          metadata: { reason: 'spam' },
          createdAt: new Date('2026-01-15T10:00:00Z'),
        },
      ];
      const prisma = buildPrisma(rows);
      const service = new AuditLogExportService(prisma);

      const stream = service.exportCsv({} as AuditLogQueryDto);
      const csv = await streamToString(stream);

      // Header must be present and contain the documented columns.
      expect(csv.split('\n')[0]).toContain('id');
      expect(csv.split('\n')[0]).toContain('action');
      expect(csv.split('\n')[0]).toContain('ip');
      expect(csv.split('\n')[0]).toContain('userAgent');
      expect(csv.split('\n')[0]).toContain('metadata');
      // Data row must include the action and ip values.
      expect(csv).toContain('admin.user.status_change');
      expect(csv).toContain('127.0.0.1');
    });

    it('returns an empty stream (header only) when no rows match', async () => {
      const prisma = buildPrisma([]);
      const service = new AuditLogExportService(prisma);

      const stream = service.exportCsv({} as AuditLogQueryDto);
      const csv = await streamToString(stream);

      // Header present, no data lines.
      const lines = csv.split('\n').filter((l) => l.length > 0);
      expect(lines).toHaveLength(1);
    });
  });

  describe('exportNdjson', () => {
    it('emits one JSON object per line', async () => {
      const rows: AuditLogRow[] = [
        {
          id: 'a1',
          actorUserId: 'u1',
          action: 'admin.user.status_change',
          entityType: 'user',
          entityId: 'u2',
          ip: '127.0.0.1',
          userAgent: 'curl/8.0',
          metadata: { reason: 'spam' },
          createdAt: new Date('2026-01-15T10:00:00Z'),
        },
        {
          id: 'a2',
          actorUserId: 'u1',
          action: 'admin.company.verify',
          entityType: 'company',
          entityId: 'c1',
          ip: '10.0.0.1',
          userAgent: 'curl/8.0',
          metadata: null,
          createdAt: new Date('2026-01-15T10:05:00Z'),
        },
      ];
      const prisma = buildPrisma(rows);
      const service = new AuditLogExportService(prisma);

      const stream = service.exportNdjson({} as AuditLogQueryDto);
      const text = await streamToString(stream);

      const lines = text.split('\n').filter((l) => l.length > 0);
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0]) as { id: string; action: string };
      const second = JSON.parse(lines[1]) as { id: string; action: string };
      expect(first.id).toBe('a1');
      expect(first.action).toBe('admin.user.status_change');
      expect(second.id).toBe('a2');
    });
  });

  describe('exportJson', () => {
    it('emits a JSON array', async () => {
      const rows: AuditLogRow[] = [
        {
          id: 'a1',
          actorUserId: 'u1',
          action: 'admin.user.status_change',
          entityType: 'user',
          entityId: 'u2',
          ip: '127.0.0.1',
          userAgent: 'curl/8.0',
          metadata: null,
          createdAt: new Date('2026-01-15T10:00:00Z'),
        },
      ];
      const prisma = buildPrisma(rows);
      const service = new AuditLogExportService(prisma);

      const stream = service.exportJson({} as AuditLogQueryDto);
      const text = await streamToString(stream);

      const parsed = JSON.parse(text) as Array<{ id: string; action: string }>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('a1');
    });
  });

  describe('searchByMetadata', () => {
    it('uses JSONB containment filter', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'a1',
            actorUserId: 'u1',
            action: 'admin.user.status_change',
            entityType: 'user',
            entityId: 'u2',
            ip: '127.0.0.1',
            userAgent: 'curl/8.0',
            metadata: { reason: 'spam' },
            createdAt: new Date('2026-01-15T10:00:00Z'),
          },
        ])
        .mockResolvedValueOnce([]);
      const prisma = { auditLog: { findMany, findFirst: jest.fn() } };
      const service = new AuditLogExportService(prisma);

      const result = await service.searchByMetadata(
        'reason',
        'spam',
        {} as AuditLogQueryDto,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('a1');
      const firstCall = findMany.mock.calls[0][0];
      expect(firstCall.where.metadata).toEqual({
        path: ['reason'],
        equals: 'spam',
      });
    });
  });
});
