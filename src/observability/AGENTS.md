<!-- Parent: ../AGENTS.md -->

# Observability Domain

## Purpose

The Observability domain provides a Prometheus-compatible `/metrics` endpoint and global HTTP request instrumentation. It owns its own private Prometheus `Registry` so it does not interfere with the OpenTelemetry pipeline already configured in `src/instrumentation.ts`.

## Key Files

| File                          | Purpose                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `metrics.service.ts`          | Private `Registry` + Counter/Gauge/Histogram definitions; recording methods for HTTP, outbox, billing, media, GDPR/DSR, and audit log events |
| `metrics.controller.ts`       | `GET /metrics` returns Prometheus text format, marked `@Public()` so scrapers do not need authentication                                     |
| `http-metrics.interceptor.ts` | Global NestJS interceptor that records method/route/status/duration for every HTTP request, bound via `APP_INTERCEPTOR`                      |
| `observability.module.ts`     | Module wiring; exports `MetricsService` for other domains to record domain-specific events                                                   |

## Recording Conventions

- **No PII in labels**: `route` is the matched route pattern (e.g. `/users/:id`), not the raw URL, to prevent label cardinality explosion.
- **Status codes are strings**: HTTP status codes are stringified when used as label values to keep `prom-client` happy.
- **Durations are seconds**: `Histogram` observations are in seconds; the interceptor converts from milliseconds before observing.
- **Distinct registries per test**: Each `MetricsService` instance creates its own `Registry` so unit tests do not leak counters across cases.

## Adding a New Metric

1. Define the metric on the private `Registry` inside `MetricsService`'s constructor.
2. Expose a public recording method with a narrow parameter type so consumers cannot inject arbitrary labels.
3. Add a test in `metrics.service.spec.ts` that records an event and asserts the resulting line in `getMetrics()` output.
4. Wire the call site in the appropriate domain service (e.g. a billing transition, an outbox processor).

## For AI Agents

- **Always prefer the route pattern** when recording HTTP metrics; never use the raw request path as a label.
- **Never add PII** (user id, email, IP) to label values. Use aggregate counts only.
- **Keep label cardinality bounded**: if a label would have unbounded values (e.g. user id, uuid), do not add it.
- **Test before adding** — update the spec first, watch it fail, then implement the recording method.
- **Do not export the Registry** — it is intentionally private to prevent cross-test contamination.

## Common Patterns

Recording a domain event from another service:

```ts
constructor(
  private readonly metricsService: MetricsService,
) {}

async onSubscriptionActivated(subscription: Subscription): Promise<void> {
  this.metricsService.recordSubscriptionChange('active');
}
```

The `MetricsService` is exported from `ObservabilityModule`; import it in the consuming module's `imports` array.
