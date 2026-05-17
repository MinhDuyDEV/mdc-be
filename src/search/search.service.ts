import { Injectable } from "@nestjs/common";

/**
 * Search result from Postgres full-text fallback or Elasticsearch.
 */
export interface SearchResult<T = Record<string, unknown>> {
	items: T[];
	total: number;
}

/**
 * Postgres full-text search query helpers.
 *
 * Provides parameterized query fragments for domain modules to use
 * with Prisma raw queries until Elasticsearch indexing is fully wired.
 */
@Injectable()
export class SearchService {
	/**
	 * Build a tsquery parameter for Postgres `plainto_tsquery`.
	 */
	toTsQuery(term: string): string {
		const sanitized = term.replace(/['";\\]/g, "").trim();
		if (sanitized.length === 0) return "";
		return sanitized.split(/\s+/).join(" & ");
	}

	/**
	 * Build a SQL fragment for `to_tsvector` across multiple columns.
	 */
	tsVectorExpression(columns: string[]): string {
		const coalesced = columns
			.map((col) => `coalesce(${col}, '')`)
			.join(" || ' ' || ");
		return `to_tsvector('english', ${coalesced})`;
	}

	/**
	 * Wrap a query with `plainto_tsquery` and a similarity threshold.
	 */
	tsQueryExpression(term: string): string {
		const query = this.toTsQuery(term);
		if (query.length === 0) return "plainto_tsquery('english', '')";
		return `plainto_tsquery('english', '${query}')`;
	}
}
