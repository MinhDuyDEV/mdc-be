import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

interface RouteLayer {
  path?: string;
}

/**
 * Records HTTP request metrics via the {@link MetricsService} for every
 * inbound HTTP request handled by the NestJS pipeline.
 *
 * The `route` label prefers the matched route pattern (e.g. `/users/:id`)
 * over the raw request path to keep label cardinality bounded; we fall back
 * to the raw URL only if the router has not yet attached a route pattern.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const method = request.method;
    const route = this.resolveRoute(request);
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.record(method, route, response.statusCode, startedAt),
        error: () => this.record(method, route, response.statusCode, startedAt),
      }),
    );
  }

  private resolveRoute(request: Request): string {
    // Express types declare `request.route` as `any` because the layer type
    // is augmented by the router at runtime. Narrow it locally so the
    // downstream label is always a bounded string.
    const layer = request.route as RouteLayer | undefined;
    const routePath = layer?.path;
    if (typeof routePath === 'string' && routePath.length > 0) {
      return routePath;
    }
    return request.path || 'unknown';
  }

  private record(
    method: string,
    route: string,
    statusCode: number,
    startedAt: number,
  ): void {
    const durationMs = Date.now() - startedAt;
    this.metricsService.recordHttpRequest(
      method,
      route,
      statusCode,
      durationMs,
    );
  }
}
