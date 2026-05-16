import {
  type ArgumentMetadata,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ApiExceptionFilter } from './errors';
import {
  CursorPaginationQueryDto,
  createApiResponse,
  createValidationPipe,
  IS_PUBLIC_ROUTE,
  Public,
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

  it('maps plain errors to an internal server error envelope', () => {
    const filter = new ApiExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({}),
      }),
    } as never;

    filter.catch(new Error('do not leak this'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  });

  it('maps HTTP parser errors to the public error envelope', () => {
    const filter = new ApiExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({}),
      }),
    } as never;

    filter.catch(
      { statusCode: 413, message: 'request entity too large' },
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'request entity too large',
      },
    });
  });

  it('defines cursor pagination defaults and placeholder auth/policy exports', () => {
    const pagination = new CursorPaginationQueryDto();

    expect(pagination.limit).toBe(20);
    expect(typeof Public).toBe('function');
    expect(typeof IS_PUBLIC_ROUTE).toBe('symbol');
  });

  it('rejects invalid cursor pagination query values', async () => {
    const pipe = createValidationPipe();
    const metadata: ArgumentMetadata = {
      type: 'query',
      metatype: CursorPaginationQueryDto,
      data: '',
    };

    await expect(pipe.transform({ limit: '0' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ limit: '200' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ cursor: 123 }, metadata)).rejects.toThrow();
  });
});
