import { Module } from '@nestjs/common';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Observability domain.
 *
 * Exposes a Prometheus-compatible `/metrics` endpoint and records HTTP
 * request, outbox event, and business-domain metrics for scraping.
 *
 * The `HttpMetricsInterceptor` is registered globally via `APP_INTERCEPTOR`
 * so every HTTP request produces a counter + histogram observation without
 * requiring per-controller wiring.
 */
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    HttpMetricsInterceptor,
    {
      provide: 'APP_INTERCEPTOR',
      useExisting: HttpMetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule {}
