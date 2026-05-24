import { ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyKeyInterceptor } from './idempotency-key.interceptor';

describe('IdempotencyKeyInterceptor', () => {
  function prismaError(code: string): Error & { code: string } {
    return Object.assign(new Error(code), { code });
  }

  function createHarness() {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        scope: 'CompaniesController.createCompany',
      }),
    };
    const prisma = {
      idempotencyKey: {
        create: jest.fn().mockResolvedValue({ id: 'key-1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'key-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'key-1' }),
      },
    };
    const request: {
      body: Record<string, string>;
      headers: Record<string, string>;
    } = {
      body: { name: 'Acme Corp', industry: 'TECHNOLOGY' },
      headers: { 'idempotency-key': 'retry-key' },
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      statusCode: 201,
    };
    const context = {
      getClass: jest.fn(),
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    };
    const next = {
      handle: jest
        .fn()
        .mockReturnValue(of({ createdAt: new Date('2026-05-23T00:00:00Z') })),
    };
    const interceptor = new IdempotencyKeyInterceptor(
      reflector as unknown as Reflector,
      prisma as any,
    );

    return { context, interceptor, next, prisma, reflector, request, response };
  }

  it('passes through when route is not annotated', async () => {
    const { context, interceptor, next, prisma, reflector } = createHarness();
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next)),
    ).resolves.toEqual({ createdAt: new Date('2026-05-23T00:00:00Z') });

    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('passes through when Idempotency-Key is absent', async () => {
    const { context, interceptor, next, prisma, request } = createHarness();
    request.headers = {};

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next)),
    ).resolves.toEqual({ createdAt: new Date('2026-05-23T00:00:00Z') });

    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('claims new keys and stores JSON-safe response bodies', async () => {
    const { context, interceptor, next, prisma } = createHarness();

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next)),
    ).resolves.toEqual({ createdAt: new Date('2026-05-23T00:00:00Z') });

    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'CompaniesController.createCompany',
        key: 'retry-key',
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith({
      where: {
        scope_key: {
          scope: 'CompaniesController.createCompany',
          key: 'retry-key',
        },
      },
      data: {
        responseStatus: 201,
        responseBody: { createdAt: '2026-05-23T00:00:00.000Z' },
      },
    });
  });

  it('replays stored responses without calling the handler', async () => {
    const { context, interceptor, next, prisma, response } = createHarness();
    let requestHash = '';
    prisma.idempotencyKey.create.mockImplementation(({ data }) => {
      requestHash = data.requestHash;
      return Promise.reject(prismaError('P2002'));
    });
    prisma.idempotencyKey.findUnique.mockImplementation(() =>
      Promise.resolve({
        requestHash,
        responseStatus: 201,
        responseBody: { id: 'stored-company' },
      }),
    );

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next)),
    ).resolves.toEqual({ id: 'stored-company' });

    expect(response.status).toHaveBeenCalledWith(201);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('rejects reused keys when request bodies differ', async () => {
    const { context, interceptor, next, prisma } = createHarness();
    prisma.idempotencyKey.create.mockRejectedValue(prismaError('P2002'));
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'different-hash',
      responseStatus: 201,
      responseBody: { id: 'stored-company' },
    });

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next)),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(next.handle).not.toHaveBeenCalled();
  });

  it('releases new claims when the handler fails', async () => {
    const { context, interceptor, next, prisma } = createHarness();
    next.handle.mockReturnValue(throwError(() => new Error('boom')));

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next)),
    ).rejects.toThrow('boom');

    expect(prisma.idempotencyKey.delete).toHaveBeenCalledWith({
      where: {
        scope_key: {
          scope: 'CompaniesController.createCompany',
          key: 'retry-key',
        },
      },
    });
  });
});
