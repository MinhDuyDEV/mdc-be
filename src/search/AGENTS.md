<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# search

## Purpose
Search infrastructure module providing Postgres full-text search helpers and Elasticsearch indexing facade. Supports domain modules with parameterized query builders for tsquery/tsvector and graceful fallback when Elasticsearch is unavailable.

## Key Files
| File | Description |
|------|-------------|
| `search.module.ts` | Module configuration importing InfraModule |
| `search.service.ts` | Postgres full-text search query helpers (toTsQuery, tsVectorExpression, tsQueryExpression) |
| `search-index.service.ts` | Elasticsearch indexing facade for outbox processors |

## For AI Agents

### Working In This Directory
- SearchService provides Postgres full-text search helpers for domain modules to use with Prisma raw queries
- Column names are validated against strict identifier pattern to prevent SQL injection
- SearchIndexService wraps Elasticsearch operations with graceful degradation (logs warnings on failure)
- Domain modules should use SearchService for immediate search needs and SearchIndexService for async indexing
- Elasticsearch indexing is triggered by outbox processors, not directly by domain modules

### Testing Requirements
- Test toTsQuery sanitizes input and joins terms with &
- Test tsVectorExpression validates column names and rejects invalid identifiers
- Test tsQueryExpression wraps query with plainto_tsquery
- Test SearchIndexService logs warnings on Elasticsearch failures (no exceptions thrown)
- Verify column name validation prevents SQL injection

### Common Patterns
- Use SearchService.toTsQuery to sanitize user input for Postgres full-text search
- Use SearchService.tsVectorExpression to build to_tsvector expressions for multiple columns
- Use SearchIndexService.indexDocument for async Elasticsearch indexing (called by outbox processors)
- Graceful degradation: Elasticsearch failures are logged but do not break the application

## Dependencies

### Internal
- `../infra` - PrismaService for raw queries, SearchEngineService for Elasticsearch
- `nestjs-pino` - Structured logging for SearchIndexService

### External
- `@nestjs/common` - NestJS core decorators and exceptions
