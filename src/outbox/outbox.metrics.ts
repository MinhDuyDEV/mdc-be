import { Injectable } from '@nestjs/common';
import {
  metrics,
  type Counter,
  type Histogram,
  type ObservableCallback,
  type ObservableGauge,
} from '@opentelemetry/api';

@Injectable()
export class OutboxMetrics {
  private readonly eventsProcessed: Counter;
  private readonly eventsFailed: Counter;
  private readonly eventsDeadLettered: Counter;
  private readonly dispatchDurationMs: Histogram;
  private readonly pendingEvents: ObservableGauge;
  private readonly retryLatencySeconds: Histogram;
  private readonly pendingByEventType: ObservableGauge;
  private pendingEventsCallback?: ObservableCallback;
  private pendingByEventTypeCallback?: ObservableCallback;

  constructor() {
    const meter = metrics.getMeter('mdc-be.outbox');
    this.eventsProcessed = meter.createCounter('outbox.events.processed', {
      description: 'Outbox events successfully processed',
    });
    this.eventsFailed = meter.createCounter('outbox.events.failed', {
      description: 'Outbox events that failed processing',
    });
    this.eventsDeadLettered = meter.createCounter(
      'outbox.events.dead_lettered',
      {
        description: 'Outbox events moved to dead letter storage',
      },
    );
    this.dispatchDurationMs = meter.createHistogram(
      'outbox.dispatch.duration_ms',
      {
        description: 'Outbox event dispatch duration in milliseconds',
        unit: 'ms',
      },
    );
    this.pendingEvents = meter.createObservableGauge('outbox.pending.count', {
      description: 'Outbox events currently pending dispatch',
    });

    // H8: Retry latency histogram with buckets from sub-second to minutes.
    // Used to track how long events spend between retry attempts.
    this.retryLatencySeconds = meter.createHistogram(
      'outbox.retry_latency_seconds',
      {
        description:
          'Time between outbox event retry attempts in seconds, by event type',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
        },
      },
    );

    // H8: Per-event-type pending queue gauge.
    // Allows operators to quickly see which event types are backlogged.
    this.pendingByEventType = meter.createObservableGauge(
      'outbox.pending_by_event_type',
      {
        description:
          'Outbox events pending dispatch, broken down by event type',
      },
    );
  }

  recordProcessed(eventType: string): void {
    this.eventsProcessed.add(1, { event_type: eventType });
  }

  recordFailed(eventType: string, attempts: number): void {
    this.eventsFailed.add(1, {
      event_type: eventType,
      attempts,
    });
  }

  recordDeadLettered(eventType: string): void {
    this.eventsDeadLettered.add(1, { event_type: eventType });
  }

  recordDispatchDuration(
    eventType: string,
    status: 'success' | 'failure',
    durationMs: number,
  ): void {
    this.dispatchDurationMs.record(durationMs, {
      event_type: eventType,
      status,
    });
  }

  /**
   * Records the time between consecutive retry attempts for an event.
   * The value is the elapsed wall-clock time since the previous attempt.
   */
  recordRetryLatency(eventType: string, latencySeconds: number): void {
    this.retryLatencySeconds.record(latencySeconds, {
      event_type: eventType,
    });
  }

  registerPendingGauge(
    readPendingCount: () => Promise<number>,
    onError: (error: unknown) => void,
  ): void {
    if (this.pendingEventsCallback) return;

    this.pendingEventsCallback = async (observableResult) => {
      try {
        observableResult.observe(await readPendingCount());
      } catch (error) {
        onError(error);
      }
    };
    this.pendingEvents.addCallback(this.pendingEventsCallback);
  }

  unregisterPendingGauge(): void {
    if (!this.pendingEventsCallback) return;
    this.pendingEvents.removeCallback(this.pendingEventsCallback);
    this.pendingEventsCallback = undefined;
  }

  /**
   * Registers a callback that reads the count of PENDING events grouped
   * by event type. Each entry becomes a separate gauge observation with
   * an `event_type` attribute.
   */
  registerPendingByEventTypeGauge(
    readPendingCounts: () => Promise<
      Array<{ eventType: string; count: number }>
    >,
    onError: (error: unknown) => void,
  ): void {
    if (this.pendingByEventTypeCallback) return;

    this.pendingByEventTypeCallback = async (observableResult) => {
      try {
        const counts = await readPendingCounts();
        for (const { eventType, count } of counts) {
          observableResult.observe(count, { event_type: eventType });
        }
      } catch (error) {
        onError(error);
      }
    };
    this.pendingByEventType.addCallback(this.pendingByEventTypeCallback);
  }

  unregisterPendingByEventTypeGauge(): void {
    if (!this.pendingByEventTypeCallback) return;
    this.pendingByEventType.removeCallback(this.pendingByEventTypeCallback);
    this.pendingByEventTypeCallback = undefined;
  }
}
