import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import type { MetricsService } from './metrics.service';

interface RecordedCall {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

interface MockRequest {
  method: string;
  path: string;
  route?: { path: string };
}

interface MockResponse {
  statusCode: number;
}

function buildContext(
  request: MockRequest,
  response: MockResponse,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request as never,
      getResponse: () => response as never,
      getNext: () => ({}),
    }),
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
    getClass: () => HttpMetricsInterceptor as never,
    getHandler: () => ({}) as never,
    getArgsLength: () => 0,
    getArgByIndex2: () => undefined,
  } as unknown as ExecutionContext;
}

describe('HttpMetricsInterceptor', () => {
  let recorded: RecordedCall[];
  let interceptor: HttpMetricsInterceptor;

  beforeEach(() => {
    recorded = [];
    const metricsService = {
      recordHttpRequest: (
        method: string,
        route: string,
        statusCode: number,
        durationMs: number,
      ) => {
        recorded.push({ method, route, statusCode, durationMs });
      },
    } as unknown as MetricsService;
    interceptor = new HttpMetricsInterceptor(metricsService);
  });

  it('records HTTP request with method, route pattern, status code, and duration', async () => {
    const request: MockRequest = {
      method: 'GET',
      path: '/api/v1/users/123',
      route: { path: '/api/v1/users/:id' },
    };
    const response: MockResponse = { statusCode: 200 };
    const ctx = buildContext(request, response);
    const handler: CallHandler = { handle: () => of('ok') };

    await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      method: 'GET',
      route: '/api/v1/users/:id',
      statusCode: 200,
    });
    expect(recorded[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back to request path when route pattern is not yet resolved', async () => {
    const request: MockRequest = {
      method: 'POST',
      path: '/api/v1/users',
    };
    const response: MockResponse = { statusCode: 201 };
    const ctx = buildContext(request, response);
    const handler: CallHandler = { handle: () => of('created') };

    await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      method: 'POST',
      route: '/api/v1/users',
      statusCode: 201,
    });
  });

  it('records the response status code even when the handler errors', async () => {
    const request: MockRequest = {
      method: 'GET',
      path: '/api/v1/broken',
      route: { path: '/api/v1/broken' },
    };
    const response: MockResponse = { statusCode: 500 };
    const ctx = buildContext(request, response);
    const handler: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(ctx, handler)),
    ).rejects.toThrow('boom');

    expect(recorded).toHaveLength(1);
    expect(recorded[0].statusCode).toBe(500);
  });
});
