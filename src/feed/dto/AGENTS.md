<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Feed DTOs

## Purpose
Data transfer objects for personalized content feed queries. Validates feed filtering, sorting, and pagination parameters.

## Key Files
| File | Description |
|------|-------------|
| feed-query.dto.ts | Query parameters for feed retrieval (cursor, limit, filters, sort order) |

## For AI Agents

### Working In This Directory
- Feed queries support cursor-based pagination for infinite scroll
- Filter options include content type (posts, jobs, articles), author, tags
- Sort options: chronological, relevance, popularity
- Default feed includes posts from connections and followed companies
- Feed algorithm considers user preferences and engagement history

### Testing Requirements
- Test pagination with various cursor values
- Test filter combinations (multiple content types, tags)
- Test sort order (chronological vs relevance)
- Verify default feed behavior (no filters)
- Run tests: `npm test -- src/feed`

### Common Patterns
- Pagination: `@IsOptional() @IsString() cursor?: string; @IsInt() @Min(1) @Max(50) limit?: number`
- Filtering: `@IsOptional() @IsArray() @IsEnum(ContentType, { each: true }) types?: ContentType[]`
- Sorting: `@IsOptional() @IsEnum(FeedSortOrder) sort?: FeedSortOrder`
- Date range: `@IsOptional() @IsISO8601() since?: string`

## Dependencies

### Internal
- Used by `FeedController` for request validation
- Used by `FeedService` for feed generation
- May integrate with recommendation engine for personalized content

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
