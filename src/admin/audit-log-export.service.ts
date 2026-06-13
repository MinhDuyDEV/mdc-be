import { Injectable } from "@nestjs/common";
import { Readable } from "node:stream";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { AuditLogQueryDto } from "./dto/audit-log-query.dto";

const CSV_COLUMNS: ReadonlyArray<keyof AuditLogRow> = [
  "id",
  "actorUserId",
  "action",
  "entityType",
  "entityId",
  "ip",
  "userAgent",
  "metadata",
  "createdAt",
];

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

interface PrismaLike {
  auditLog: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<AuditLogRow[]>;
    findFirst: (args: { where: Record<string, unknown> }) => Promise<AuditLogRow | null>;
  };
}

@Injectable()
export class AuditLogExportService {
  constructor(private readonly prisma: PrismaLike) {}

  /**
   * Streams matching audit log rows as CSV. The first line is the header.
   * The stream is fully self-contained: a downstream consumer can pipe it
   * directly to an HTTP response.
   */
  exportCsv(query: AuditLogQueryDto): Readable {
    const rows = this.fetchAllRows(query);
    return Readable.from(
      (async function* (): AsyncGenerator<string> {
        yield CSV_COLUMNS.join(",") + "\n";
        for await (const row of rows) {
          yield CSV_COLUMNS.map((c) => formatCsvValue(row[c])).join(",") + "\n";
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
        yield "[";
        for await (const row of rows) {
          yield (isFirst ? "" : ",") + JSON.stringify(row);
          isFirst = false;
        }
        yield "]";
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
          yield JSON.stringify(row) + "\n";
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
    const rows = await this.prisma.auditLog.findMany({ where });
    return {
      data: rows,
      meta: { hasNextPage: false },
    };
  }

  private async *fetchAllRows(query: AuditLogQueryDto): AsyncGenerator<AuditLogRow> {
    const where = this.buildWhere(query);
    const rows = await this.prisma.auditLog.findMany({ where });
    for (const row of rows) {
      yield row;
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
    return "";
  }
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === "object") {
    text = JSON.stringify(value);
  } else if (typeof value === "string") {
    text = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    text = String(value);
  } else {
    // Unreachable for the audit log columns (bigint/symbol are not used);
    // return an empty cell rather than rely on Object.prototype
    // stringification.
    text = "";
  }
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// Allow the constructor to accept the real PrismaService (structural typing
// is narrower than the rich PrismaClient surface).
export type { PrismaService };
