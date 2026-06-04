/**
 * Shared database helpers for handling Prisma raw-query results.
 *
 * Extracted from `analytics.service.ts` so that any module dealing with
 * `$queryRaw` results can reuse the same helpers.
 */

/** The shape returned by `COUNT(*)` / `COUNT(DISTINCT …)` via `$queryRaw`. */
export type CountResult = { count: bigint | number | null };

/**
 * Safely read the count from a raw-query result set.
 * Returns `0` when the result is empty or the count is null/undefined.
 */
export function readCount(result: CountResult[]): number {
  const count = result[0]?.count;
  return count === null || count === undefined ? 0 : Number(count);
}
