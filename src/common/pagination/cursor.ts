/**
 * Shared cursor-pagination utilities for keyset-based pagination.
 *
 * All list endpoints should use these helpers instead of reimplementing
 * `encodeCursor` / `decodeCursor` locally.
 *
 * Format: base64(JSON.stringify({ createdAt: ISO-string, id: string }))
 *
 * ## Usage
 *
 * ```ts
 * import { encodeCursor, decodeCursor, paginateRows } from '../common/pagination/cursor';
 *
 * // Decode incoming cursor
 * const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
 *
 * // Build WHERE clause
 * const where: Prisma.PostWhereInput = {
 *   ...filters,
 *   ...(cursor ? {
 *     OR: [
 *       { createdAt: { lt: cursor.createdAt } },
 *       { createdAt: cursor.createdAt, id: { lt: cursor.id } },
 *     ],
 *   } : {}),
 * };
 *
 * // Fetch with limit + 1 to detect hasNextPage
 * const rows = await prisma.post.findMany({ where, orderBy, take: query.limit + 1 });
 *
 * // Build paginated result
 * const { items, nextCursor, hasNextPage } = paginateRows(rows, query.limit);
 * ```
 */

/**
 * Encode a `(createdAt, id)` pair as a base64 JSON cursor.
 *
 * For services that need a different field *name* (e.g. `submittedAt` instead of
 * `createdAt`) simply pass the timestamp as the first argument — the JSON key
 * is an implementation detail that must only be consistent between
 * `encodeCursor` and `decodeCursor`.
 */
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
  ).toString('base64');
}

/**
 * Decode a base64 JSON cursor back to a `(createdAt, id)` pair.
 *
 * Returns `null` for any malformed input (invalid base64, invalid JSON, missing
 * fields) rather than throwing, so callers can fall back to fetching from the
 * start of the result set.
 */
export function decodeCursor(
  cursor: string,
): { createdAt: Date; id: string } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    ) as {
      createdAt?: string;
      id?: string;
    };
    if (!decoded?.createdAt || !decoded?.id) return null;
    return { createdAt: new Date(decoded.createdAt), id: decoded.id };
  } catch {
    return null;
  }
}

/**
 * Build an `OR`-based keyset WHERE clause for a cursor-decoded value.
 *
 * Result is suitable for spreading into a Prisma `where`:
 *
 * ```ts
 * where: { ...filters, ...(cursor ? buildCursorWhere(cursor) : {}) }
 * ```
 */
export function buildCursorWhere(decoded: { createdAt: Date; id: string }): {
  OR: [{ createdAt: { lt: Date } }, { createdAt: Date; id: { lt: string } }];
} {
  return {
    OR: [
      { createdAt: { lt: decoded.createdAt } },
      { createdAt: decoded.createdAt, id: { lt: decoded.id } },
    ],
  };
}

/**
 * Given a `findMany` result set that was fetched with `take: limit + 1`,
 * split off the extra row and build `hasNextPage` / `nextCursor`.
 *
 * @returns items trimmed to `limit`, plus cursor metadata.
 */
export function paginateRows<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor?: string; hasNextPage: boolean } {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      hasNextPage && last ? encodeCursor(last.createdAt, last.id) : undefined,
    hasNextPage,
  };
}
