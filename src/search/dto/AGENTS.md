<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Search DTOs

## Purpose
Data transfer objects for unified search across all content types (jobs, profiles, posts, companies). Validates search queries and structures search results.

## Key Files
| File | Description |
|------|-------------|
| search.query.dto.ts | Query parameters for search requests (query string, filters, pagination, sorting) |
| search.response.dto.ts | Response structure for search results with facets, highlights, and aggregations |

## For AI Agents

### Working In This Directory
- Query DTOs support full-text search across multiple content types
- Filters include content type, date range, location, industry, skills
- Pagination uses cursor-based approach for consistent results
- Response DTOs include search highlights (matched text snippets)
- Facets provide aggregated counts for filtering (e.g., 50 jobs, 20 profiles)
- Search supports fuzzy matching, synonyms, and relevance scoring

### Testing Requirements
- Test query validation (empty, special characters, max length)
- Test filter combinations (multiple types, date ranges)
- Test pagination with various cursor values
- Verify response includes highlights and facets
- Test relevance scoring (most relevant results first)
- Run tests: `npm test -- src/search`

### Common Patterns
- Query DTO: `@IsString() @MinLength(1) @MaxLength(200) query: string; @IsOptional() @IsArray() @IsEnum(ContentType, { each: true }) types?: ContentType[]`
- Filters: `@IsOptional() @IsISO8601() startDate?: string; @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[]`
- Response DTO: `{ results: T[]; facets: Record<string, number>; highlights: Record<string, string[]>; total: number }`
- Pagination: `@IsOptional() @IsString() cursor?: string; @IsInt() @Min(1) @Max(100) limit?: number`

## Dependencies

### Internal
- Used by `SearchController` for request/response validation
- Used by `SearchService` for search orchestration
- Integrates with `SearchIndexService` for Elasticsearch queries
- Uses `SearchFallbackService` for database fallback when Elasticsearch unavailable

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
