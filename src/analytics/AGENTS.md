<!-- Parent: ../AGENTS.md -->

# Analytics Domain

## Purpose

Event tracking and metrics aggregation for platform analytics. Records view events (profile views, company views, post impressions) with privacy-preserving IP hashing and provides aggregated metrics via slotted counters for efficient counting at scale.

## Key Files

- **analytics.module.ts** - Module definition importing InfraModule
- **analytics.controller.ts** - REST controller for recording events and retrieving metrics
- **analytics.service.ts** - Service layer implementing event recording with slotted counters and metrics retrieval
- **dto/** - Request/response DTOs for analytics operations

## Subdirectories

- **dto/** - Data transfer objects including `RecordEventDto`, `EntityAnalyticsDto`, `DashboardMetricsDto`, and `AnalyticsEventType` enum

## For AI Agents

### Working Instructions

1. **Event Recording**:
   - Use `recordEvent()` to track views/impressions
   - IP addresses are hashed with SHA-256 before storage (privacy-preserving)
   - Events are written to specific tables (`profile_views`, `company_views`, `post_impressions`)
   - Slotted counters are updated atomically in the same transaction

2. **Slotted Counter Pattern**:
   - Uses 20 slots (`SLOT_COUNT = 20`) to reduce write contention
   - Random slot assignment on each event
   - Counter upsert: `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1`
   - Aggregation: `SUM(count)` across all slots for total views

3. **Metrics Retrieval**:
   - `getEntityAnalytics()` returns: `totalViews`, `uniqueViewers`, `last7Days`, `last30Days`
   - `getDashboardMetrics()` returns daily counts for users, posts, jobs, applications, reports
   - Time windows: 7 days = 7 * 24 * 60 * 60 * 1000ms, 30 days = 30 * 24 * 60 * 60 * 1000ms

4. **Event Types**:
   - `PROFILE_VIEW` - Profile page views
   - `COMPANY_VIEW` - Company page views
   - `POST_IMPRESSION` - Post impressions in feed

5. **Privacy Considerations**:
   - IP addresses are hashed before storage
   - User agent strings are stored for analytics but not exposed in public APIs
   - Unique viewer counts use `COUNT(DISTINCT user_id)` (excludes anonymous views)

### Testing Requirements

- Mock `PrismaService` for all database operations
- Test event recording for all event types (profile_view, company_view, post_impression)
- Test slotted counter upsert logic (insert new, increment existing)
- Test metrics aggregation (SUM across slots, COUNT DISTINCT for unique viewers)
- Test time window filtering (7 days, 30 days)
- Test IP hashing (verify SHA-256 output)
- Test transaction atomicity (event row + counter update)

### Common Patterns

- **Async Event Writing**: `writeEventAsync()` wraps event + counter in transaction
- **Type-Specific Metrics**: Switch on `entityType` to query the correct event table
- **BigInt Handling**: Convert `bigint` results to `number` via `Number()` cast
- **Null Safety**: Use `readCount()` helper to safely extract count from query results

## Dependencies

### Internal (Allowed by eslint.config.mjs)

- **auth** - AuthGuard for protected endpoints (optional auth for some routes)

### External

- **@nestjs/common** - Controller, service, decorators
- **crypto** - SHA-256 hashing for IP addresses
- **infra** - PrismaService for database access

## Notes

- Slotted counters reduce write contention on high-traffic entities
- Event tables store raw events for detailed analytics; slotted counters provide fast aggregation
- Dashboard metrics use `createdAt >= today` filter for daily counts
- Unique viewer counts only include authenticated users (anonymous views counted in total but not unique)
- The service uses raw SQL (`$queryRaw`, `$executeRaw`) for counter operations and aggregations
