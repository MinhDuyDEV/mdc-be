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
  private pendingEventsCallback?: ObservableCallback;

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
}
