<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# search

## Purpose
Unified search infrastructure providing Elasticsearch-based full-text search with Postgres fallback. Handles search indexing, query building, and search execution across profiles, companies, jobs, and posts with zero-downtime reindex support.

## Key Files
| File | Description |
|------|-------------|
| `search.module.ts` | Module configuration importing InfraModule and ScheduleModule |
| `search.service.ts` | Core search query builder with Postgres full-text helpers and Elasticsearch query construction |
| `search-index.service.ts` | Elasticsearch indexing facade with zero-downtime reindex, alias management, and bulk operations |
| `search-query.service.ts` | High-level search query processor coordinating ES and fallback strategies |
| `search-fallback.service.ts` | Postgres full-text search fallback when Elasticsearch is unavailable |
| `search.controller.ts` | REST API endpoints for unified search across entity types |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dto/` | Search request/response DTOs |

## For AI Agents

### Working In This Directory
- **Search Query Construction**: Use `buildMultiMatchQuery()` for cross-entity searches with field boosting, `buildEntityQuery()` for single-entity searches with filters, `buildBoolQuery()` to combine clauses
- **Indexing Operations**: Call `indexDocument()` for individual documents (graceful ES failure), `createSearchIndex()` for new versioned indices with read/write aliases, `reindexEntity()` for zero-downtime reindex
- **Search Execution**: `SearchQueryService` coordinates ES primary + Postgres fallback, always return `SearchResult<T>` with items and total
- **Entity-Specific Boosting**: profiles (displayName^3, headline^2, about^1), companies (name^3, industry^2, description^1), jobs (title^3, description^1, skills^1), posts (content^2, authorName^1, hashtags^0.5)
- **Zero-Downtime Reindex**: Creates new versioned index, bulk-indexes from database, swaps write alias first, then atomically swaps read alias, deletes old index
- **Alias Strategy**: Read alias (e.g. `jobs`) for queries, write alias (`jobs-write`) for indexing, enables zero-downtime reindex
- **Column Validation**: All column names validated against `VALID_COLUMN_NAME` regex to prevent SQL injection

### Testing Requirements
- Test Postgres fallback when ES client throws
- Test zero-downtime reindex with concurrent write traffic
- Test multi-entity search with field boosting
- Test column name validation prevents SQL injection
- Test alias swap atomicity during reindex
- Test concurrent reindex prevention via SearchReindexRun table
- Test bulk reindex methods for all entity types (profiles, companies, jobs, posts)
- Mock SearchEngineService for unit tests

### Common Patterns
```typescript
// Multi-entity search with boosting
const query = searchService.buildMultiMatchQuery(
  'software engineer',
  ['profiles', 'jobs'],
  { fuzziness: 'AUTO', operator: 'and' }
);

// Entity-specific search with filters
const jobQuery = searchService.buildEntityQuery(
  'jobs',
  'backend developer',
  { status: 'PUBLISHED', workplaceType: 'REMOTE' }
);

// Zero-downtime reindex
const runId = await searchIndexService.reindexEntity(
  'jobs',
  'admin-user-id'
);

// Postgres fallback query
const tsVector = searchService.tsVectorExpression(['title', 'description']);
const tsQuery = searchService.tsQueryExpression(searchTerm);
```

## Dependencies

### Internal
- `../infra` - PrismaService for raw queries, SearchEngineService for Elasticsearch
- `nestjs-pino` - Structured logging for SearchIndexService

### External
- `@nestjs/common` - NestJS core decorators and exceptions
