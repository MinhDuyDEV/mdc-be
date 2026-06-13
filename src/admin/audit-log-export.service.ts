import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';

const CSV_COLUMNS: ReadonlyArray<keyof AuditLogRow> = [
  'id',
  'actorUserId',
  'action',
  'entityType',
  'entityId',
  'ip',
  'userAgent',
  'metadata',
  'createdAt',
];

/** Maximum rows per page fetch. Keeps each query bounded. */
const PAGE_SIZE = 1000;

/** Hard cap on total exported rows. Beyond this we emit a warning header. */
const MAX_ROWS = 100_000;

export interface AuditLogRow {
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

/** Cursor type for the compound (createdAt, id) cursor used in pagination. */
interface CursorLike {
  createdAt: Date;
  id: string;
}

interface PrismaLike {
  auditLog: {
    findMany: (args: {
      where: Record<string, unknown>;
      take: number;
      orderBy: Record<string, string>[];
      cursor?: { id: string; createdAt?: Date };
      skip?: number;
    }) => Promise<AuditLogRow[]>;
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<AuditLogRow | null>;
  };
}

@Injectable()
export class AuditLogExportService {
  constructor(private readonly prisma: PrismaLike) {}

  /**
   * Streams matching audit log rows as CSV. The first line is the header.
   * If the export is truncated by the hard cap, a warning comment is emitted
   * as the second line.
   */
  exportCsv(query: AuditLogQueryDto): Readable {
    const rows = this.fetchAllRows(query);
    return Readable.from(
      (async function* (): AsyncGenerator<string> {
        yield CSV_COLUMNS.join(',') + '\n';
        let totalEmitted = 0;
        for await (const row of rows) {
          if (totalEmitted === 0 && row === null) {
            // First yielded null is the truncation signal
            yield '# WARNING: Export truncated at ' + MAX_ROWS + ' rows\n';
            continue;
          }
          if (row === null) break; // truncation signal already handled
          yield CSV_COLUMNS.map((c) => formatCsvValue(row[c])).join(',') + '\n';
          totalEmitted++;
        }
      })(),
    );
  }

  /**
   * Streams matching audit log rows as a single JSON array. The full
   * payload is enclosed in square brackets; downstream parsers can read it
   * incrementally.
   */
  exportJson(query: AuditLogQueryDto): Readable {
    const rows = this.fetchAllRows(query);
    return Readable.from(
      (async function* (): AsyncGenerator<string> {
        let isFirst = true;
        yield '[';
        for await (const row of rows) {
          if (row === null) {
            yield isFirst
              ? ''
              : ',' +
                JSON.stringify({
                  warning: 'Export truncated at ' + MAX_ROWS + ' rows',
                });
            break;
          }
          yield (isFirst ? '' : ',') + JSON.stringify(row);
          isFirst = false;
        }
        yield ']';
      })(),
    );
  }

  /**
   * Streams matching audit log rows as newline-delimited JSON (NDJSON).
   * Each line is one complete row object.
   */
  exportNdjson(query: AuditLogQueryDto): Readable {
    const rows = this.fetchAllRows(query);
    return Readable.from(
      (async function* (): AsyncGenerator<string> {
        for await (const row of rows) {
          if (row === null) {
            yield JSON.stringify({
              warning: 'Export truncated at ' + MAX_ROWS + ' rows',
            }) + '\n';
            break;
          }
          yield JSON.stringify(row) + '\n';
        }
      })(),
    );
  }

  /**
   * Searches audit logs whose JSON `metadata` column contains the given
   * key/value pair. The Prisma `path`/`equals` filter uses JSONB
   * containment under the hood.
   */
  async searchByMetadata(
    key: string,
    value: string,
    query: AuditLogQueryDto,
  ): Promise<{ data: AuditLogRow[]; meta: { hasNextPage: boolean } }> {
    const where = {
      ...this.buildWhere(query),
      metadata: { path: [key], equals: value },
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      take: PAGE_SIZE + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const truncated = rows.slice(0, PAGE_SIZE);
    return {
      data: truncated,
      meta: { hasNextPage: rows.length > PAGE_SIZE },
    };
  }

  /**
   * Generator that yields rows in cursor-based batches of PAGE_SIZE.
   * Uses a compound (createdAt, id) cursor for efficient pagination.
   * Yields `null` as the truncation signal when the hard cap (MAX_ROWS)
   * is reached.
   */
  private async *fetchAllRows(
    query: AuditLogQueryDto,
  ): AsyncGenerator<AuditLogRow | null> {
    const where = this.buildWhere(query);
    let cursor: CursorLike | undefined;
    let totalFetched = 0;

    while (true) {
      const page = await this.prisma.auditLog.findMany({
        where,
        take: PAGE_SIZE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(cursor
          ? { cursor: { id: cursor.id, createdAt: cursor.createdAt }, skip: 1 }
          : {}),
      });

      if (page.length === 0) break;

      for (const row of page) {
        if (totalFetched >= MAX_ROWS) {
          yield null; // truncation signal
          return;
        }
        yield row;
        totalFetched++;
      }

      const last = page[page.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
    }
  }

  private buildWhere(query: AuditLogQueryDto): Record<string, unknown> {
    return {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
    };
  }
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else {
    // Unreachable for the audit log columns (bigint/symbol are not used);
    // return an empty cell rather than rely on Object.prototype
    // stringification.
    text = '';
  }
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// Allow the constructor to accept the real PrismaService (structural typing
// is narrower than the rich PrismaClient surface).
export type { PrismaService };
