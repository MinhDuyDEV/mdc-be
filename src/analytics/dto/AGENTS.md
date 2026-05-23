<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Analytics DTOs

## Purpose
Data transfer objects for analytics event recording and metrics retrieval. Validates event payloads and query parameters for analytics dashboards.

## Key Files
| File | Description |
|------|-------------|
| record-event.dto.ts | Validates analytics event recording (event type, properties, timestamp) |
| analytics-response.dto.ts | Response structure for analytics queries with metrics and aggregations |
| index.ts | Barrel export for all analytics DTOs |

## For AI Agents

### Working In This Directory
- Event DTOs validate event type, user context, and custom properties
- Response DTOs structure time-series data, aggregations, and breakdowns
- Event properties are flexible JSON objects with schema validation
- Timestamps are ISO 8601 strings or Date objects
- Support for custom dimensions and metrics in event payloads

### Testing Requirements
- Test event type validation (valid/invalid event names)
- Test property validation (nested objects, arrays, primitives)
- Test timestamp parsing (ISO strings, Date objects, invalid formats)
- Verify response DTO serialization matches expected format
- Run tests: `npm test -- src/analytics`

### Common Patterns
- Event recording: `@IsString() eventType: string; @IsObject() properties: Record<string, any>`
- Timestamp validation: `@IsOptional() @IsISO8601() timestamp?: string`
- Metrics response: `{ metric: string; value: number; breakdown?: Record<string, number> }`
- Time range queries: `@IsISO8601() startDate: string; @IsISO8601() endDate: string`

## Dependencies

### Internal
- Used by `AnalyticsController` for request/response validation
- Used by `AnalyticsService` for event processing
- May integrate with `OutboxService` for async event processing

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
