<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# src/outbox/processors

## Purpose

BullMQ job processors that handle domain events from the outbox pattern. Each processor listens for specific event types (UserRegistered, CompanyCreated, ProfileUpdated, etc.) and executes side effects asynchronously (search indexing, profile creation, email notifications). Processors are idempotent and designed to be retried on failure.

## Key Files

| File | Description |
|------|-------------|
| `profile-creation.processor.ts` | Handles UserRegistered events; creates profile shells for new users; includes cron tick for polling (future: dispatched by main OutboxProcessor); idempotent — skips if profile already exists |
| `company-search-index.processor.ts` | Handles CompanyCreated and CompanyUpdated events; indexes company data in Elasticsearch; fetches company with members and user display names; logs indexing results |
| `profile-search-index.processor.ts` | Handles ProfileUpdated events; placeholder for future Elasticsearch indexing; currently a no-op (Postgres FTS handles search indexing); includes cron tick for polling |

## For AI Agents

### Working In This Directory

- **Processor pattern**: Each processor is an `@Injectable()` service with methods matching event types (e.g., `processUserRegistered()`, `processCompanyCreated()`).
- **Idempotency**: Processors must be idempotent; design them to safely handle duplicate event processing without side effects.
- **Logging**: Use NestJS Logger for debug, info, warn, and error messages; include context (event type, entity ID) in logs.
- **Error handling**: Catch and log errors; do not throw exceptions (BullMQ will retry); return gracefully on missing entities.
- **Async operations**: Use async/await for database queries and external service calls; mark methods as `async`.
- **Payload interfaces**: Define payload interfaces at the top of each processor file; match event schema from domain events.
- **Future dispatch**: Processors are currently cron-based; will be dispatched by main OutboxProcessor in future phases.

### Testing Requirements

- **Unit tests**: Mock PrismaService and SearchEngineService; test processor methods with sample payloads.
- **Idempotency tests**: Verify processors handle duplicate events without creating duplicate side effects.
- **Error handling**: Test processors with missing entities (e.g., company not found); verify graceful handling and logging.
- **Integration tests**: Test processors with real database and search engine (if available); verify events are processed end-to-end.
- **Run tests**: `npm test` for unit tests; `npm run test:e2e` for integration tests.

### Common Patterns

- **Payload validation**: Check for required fields in payload; log warnings if data is missing.
- **Database queries**: Use Prisma with `include` to fetch related data in a single query; avoid N+1 queries.
- **Search indexing**: Call `searchEngine.index()` with entity type, ID, and indexed fields; handle indexing errors gracefully.
- **Logging context**: Include entity ID and event type in log messages for debugging (e.g., `Indexed company ${company.id}`).
- **Future phases**: Mark incomplete implementations with `// TODO: Implement in future phase` comments; include brief description of what needs to be done.

## Dependencies

### Internal

- **infra/prisma/prisma.service**: Database access; used to fetch entities and related data.
- **infra/search-engine/search-engine.service**: Elasticsearch client; used to index entities for full-text search.
- **outbox/outbox.module**: Registers processors as providers; dispatches events to processors.

### External

- **@nestjs/common**: Injectable, Logger decorators.
- **@nestjs/schedule**: Cron, CronExpression for scheduled polling (temporary; will be replaced by event dispatch).
- **bullmq**: Job queue library (future: will be used for event dispatch instead of cron).
- **prisma**: ORM for database queries.
- **elasticsearch**: Search engine client (via SearchEngineService).
