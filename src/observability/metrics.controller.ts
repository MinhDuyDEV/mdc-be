import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * Exposes Prometheus-formatted metrics at the `/metrics` endpoint.
 *
 * The route is marked `@Public()` so Prometheus scrapers do not need to
 * authenticate. Production deployments should additionally protect the
 * endpoint with an IP allowlist or basic auth at the ingress layer.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
