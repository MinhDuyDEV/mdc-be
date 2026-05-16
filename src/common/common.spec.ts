import { BadRequestException, HttpStatus } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { ApiExceptionFilter } from './errors';
import {
  CursorPaginationQueryDto,
  createApiResponse,
  Public,
  IS_PUBLIC_ROUTE,
} from './index';
import { ApiResponseInterceptor } from './response';

describe('CommonModule primitives', () => {
  it('creates success response envelopes', () => {
    expect(createApiResponse({ ok: true })).toEqual({ data: { ok: true } });
    expect(createApiResponse(['a'], { nextCursor: 'cursor-1' })).toEqual({
      data: ['a'],
      meta: { nextCursor: 'cursor-1' },
    });
  });

  it('wraps non-root responses with the API envelope', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/api/v1/example' }),
      }),
    } as never;
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) }),
    );

    expect(result).toEqual({ data: { ok: true } });
  });

  it('bypasses root and health routes when wrapping responses', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/' }),
      }),
    } as never;
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('Hello World!') }),
    );

    expect(result).toBe('Hello World!');
  });

  it('maps exceptions to the public error envelope', () => {
    const filter = new ApiExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ headers: { 'x-request-id': 'req-1' } }),
      }),
    } as never;

    filter.catch(
      new BadRequestException({
        message: 'Invalid input',
        details: { field: 'email' },
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid input',
        details: { message: 'Invalid input', details: { field: 'email' } },
        requestId: 'req-1',
      },
    });
  });

  it('defines cursor pagination defaults and placeholder auth/policy exports', () => {
    const pagination = new CursorPaginationQueryDto();

    expect(pagination.limit).toBe(20);
    expect(typeof Public).toBe('function');
    expect(typeof IS_PUBLIC_ROUTE).toBe('symbol');
  });
});
