import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics surface for the application.
 *
 * The service owns a private `Registry` (no global state) so it is testable
 * in isolation and safe to run alongside the OpenTelemetry pipeline.
 *
 * Recording methods are intentionally side-effect free; `getMetrics()` returns
 * the Prometheus text format consumed by the `/metrics` endpoint.
 */
@Injectable()
export class MetricsService implements OnApplicationShutdown {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly httpRequestsInFlight: Gauge;
  private readonly subscriptionsTotal: Counter;
  private readonly outboxEventsTotal: Counter;
  private readonly outboxEventsPending: Gauge;
  private readonly mediaUploadsTotal: Counter;
  private readonly dsrRequestsTotal: Counter;
  private readonly auditLogEntriesTotal: Counter;

  constructor() {
    this.registry = new Registry();

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests received, labelled by method, route, and status code.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds, labelled by method and route.',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently in flight, labelled by method.',
      labelNames: ['method'],
      registers: [this.registry],
    });

    this.subscriptionsTotal = new Counter({
      name: 'subscriptions_total',
      help: 'Subscription lifecycle transitions, labelled by terminal status.',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.outboxEventsTotal = new Counter({
      name: 'outbox_events_total',
      help: 'Outbox events observed with terminal processing status.',
      labelNames: ['event_type', 'status'],
      registers: [this.registry],
    });

    this.outboxEventsPending = new Gauge({
      name: 'outbox_events_pending',
      help: 'Outbox events currently in PENDING status awaiting dispatch.',
      registers: [this.registry],
    });

    this.mediaUploadsTotal = new Counter({
      name: 'media_uploads_total',
      help: 'Media uploads observed with terminal status, labelled by purpose.',
      labelNames: ['purpose', 'status'],
      registers: [this.registry],
    });

    this.dsrRequestsTotal = new Counter({
      name: 'dsr_requests_total',
      help: 'GDPR/CCPA Data Subject Requests observed, labelled by type and status.',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });

    this.auditLogEntriesTotal = new Counter({
      name: 'audit_log_entries_total',
      help: 'Total audit log entries recorded since process start.',
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: String(statusCode),
    });
    this.httpRequestDuration.observe({ method, route }, durationMs / 1000);
  }

  recordSubscriptionChange(status: string): void {
    this.subscriptionsTotal.inc({ status });
  }

  recordOutboxEvent(
    eventType: string,
    status: 'processed' | 'failed' | 'dead_lettered',
  ): void {
    this.outboxEventsTotal.inc({ event_type: eventType, status });
  }

  recordMediaUpload(purpose: string, status: 'ready' | 'quarantined'): void {
    this.mediaUploadsTotal.inc({ purpose, status });
  }

  recordDsrRequest(type: 'EXPORT' | 'DELETION', status: string): void {
    this.dsrRequestsTotal.inc({ type, status });
  }

  recordAuditLogEntry(): void {
    this.auditLogEntriesTotal.inc();
  }

  /**
   * Returns the current snapshot of the registry in Prometheus text format.
   * Intended to be served at the `/metrics` endpoint.
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Resets all metrics. Invoked on application shutdown so a restarted process
   * does not carry over in-memory counters to the next instance.
   */
  onApplicationShutdown(): void {
    this.registry.clear();
  }
}
