<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# search-engine

## Purpose
Elasticsearch integration for full-text search and indexing operations. Provides cluster health monitoring, document indexing, search queries, and bulk deletion with automatic client lifecycle management and environment-aware TLS configuration.

## Key Files
| File | Description |
|------|-------------|
| `search-engine.service.ts` | Core search operations: health checks, indexing, searching, and bulk deletion |
| `search-engine.health.ts` | Health check service with timeout protection for cluster status verification |
| `search-engine.provider.ts` | Factory provider that creates Elasticsearch client with TLS configuration |
| `search-engine.constants.ts` | DI token for search engine client |
| `index.ts` | Public exports for the search-engine module |

## For AI Agents

### Working In This Directory
- Search engine client is provided via `searchEngineProvider` factory
- Client is created with `@elastic/elasticsearch` library
- TLS certificate validation is enforced in production, disabled in development
- `SearchEngineService` implements `OnApplicationShutdown` to properly close client connections
- Health checks monitor cluster status: `red` status indicates cluster problems
- All search operations accept generic `Record<string, unknown>` for flexible query/body structures

### Testing Requirements
- Verify search engine provider creates client with correct Elasticsearch node URL
- Test `checkClusterHealth()` returns correct status based on cluster state
- Confirm `index()` successfully indexes documents with ID and body
- Validate `search()` executes queries and returns response
- Test `deleteByQuery()` removes documents matching query criteria
- Verify health check timeout behavior (should reject if cluster check exceeds timeout)
- Ensure `onApplicationShutdown()` properly closes client connection

### Common Patterns
- Inject `SEARCH_ENGINE_CLIENT` token to access Elasticsearch client
- Use `SearchEngineService` methods for all search operations
- Health checks use timeout wrapper pattern with `Promise.race()` and `setTimeout()`
- Cluster status check returns `{ status: 'up' | 'down', message?: string }`
- Configuration values are retrieved via `ConfigService.get()` with `infer: true`
- TLS configuration switches based on `NODE_ENV` environment variable

## Dependencies

### Internal
- `../config` — AppConfig type for Elasticsearch configuration

### External
- `@nestjs/common` — NestJS core decorators and lifecycle interfaces
- `@nestjs/config` — NestJS configuration service
- `@elastic/elasticsearch` — Official Elasticsearch JavaScript client
