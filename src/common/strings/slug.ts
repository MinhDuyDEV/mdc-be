/**
 * Shared slugification utilities.
 *
 * Extracted from `companies.service.ts` so that future modules
 * (jobs, posts, etc.) can reuse the same helpers without
 * re-implementing the collision-retry pattern.
 */

const MAX_SLUG_ATTEMPTS = 10;

/**
 * Normalise arbitrary text into a URL-safe slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Check whether an error represents a Prisma unique-constraint violation
 * (P2002) so callers can decide whether to retry an operation.
 */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Call `operation` with an auto-generated slug derived from `name`,
 * retrying with a numeric suffix when the slug collides with an
 * existing unique constraint (P2002).
 *
 * Throws `ConflictException` when all `MAX_SLUG_ATTEMPTS` are
 * exhausted without finding a unique slug.
 */
async function withUniqueSlug<T>(
  name: string,
  operation: (slug: string) => Promise<T>,
): Promise<T> {
  const baseSlug = slugify(name);

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      return await operation(slug);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  // Dynamically import here to keep this module tree-shakeable and avoid
  // a hard dependency on NestJS for callers that don't need HTTP semantics.
  const { ConflictException } = await import("@nestjs/common");
  throw new ConflictException("Unable to generate unique slug");
}

export { slugify, withUniqueSlug, isUniqueConstraintError, MAX_SLUG_ATTEMPTS };
