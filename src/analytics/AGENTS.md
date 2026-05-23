<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# analytics/

## Purpose

Analytics and metrics module providing insights into platform usage, user engagement, and content performance. Aggregates data from various modules to generate reports, dashboards, and trend analysis.

## Key Files

| File | Description |
|------|-------------|
| `analytics.module.ts` | NestJS module configuration with AnalyticsController and AnalyticsService |
| `analytics.controller.ts` | HTTP endpoints for analytics queries and reports |
| `analytics.service.ts` | Business logic for data aggregation, metrics calculation, and reporting |
| `analytics.service.spec.ts` | Unit tests for AnalyticsService |
| `index.ts` | Barrel export for public API |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for analytics request/response payloads |

## For AI Agents

### Working In This Directory

- **Performance considerations** — Analytics queries can be expensive; use database indexes and caching
- **Time-based aggregations** — Support date ranges, grouping by day/week/month
- **Privacy compliance** — Aggregate data only; never expose individual user PII in analytics
- **Caching strategy** — Cache expensive analytics queries in Redis with appropriate TTL
- **Async processing** — Consider background jobs for heavy analytics computations

### Testing Requirements

```bash
# Unit tests
npm test -- analytics.service.spec.ts

# E2E tests
npm run test:e2e -- analytics.e2e-spec.ts
```

### Common Patterns

**Date Range Queries:**
```typescript
@Get('engagement')
async getEngagement(
  @Query() dto: DateRangeDto,
) {
  return this.analyticsService.getEngagement(dto.startDate, dto.endDate);
}
```

**Caching Analytics:**
```typescript
const cacheKey = `analytics:engagement:${startDate}:${endDate}`;
const cached = await this.redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await this.computeEngagement(startDate, endDate);
await this.redis.setex(cacheKey, 3600, JSON.stringify(result));
return result;
```

## Dependencies

### Internal

- `src/auth/` — Authentication for analytics endpoints
- `src/common/` — Response formatting, pagination, validation
- `src/infra/prisma/` — Database queries for aggregations
- `src/infra/redis/` — Caching layer for expensive queries

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database access

<!-- MANUAL: -->
