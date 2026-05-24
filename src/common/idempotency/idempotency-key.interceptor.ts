import { createHash } from 'node:crypto';
import {
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { catchError, from, map, mergeMap, of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { PrismaService } from '../../infra/prisma';
import {
  IDEMPOTENT_REQUEST_METADATA,
  type IdempotentRequestMetadata,
} from './idempotent-request.decorator';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type ClaimResult =
  | { kind: 'claimed' }
  | { body: unknown; kind: 'replay'; status: number };
type JsonInput = Prisma.InputJsonValue | null;

@Injectable()
export class IdempotencyKeyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata =
      this.reflector.getAllAndOverride<IdempotentRequestMetadata>(
        IDEMPOTENT_REQUEST_METADATA,
        [context.getHandler(), context.getClass()],
      );

    if (!metadata) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const key = readIdempotencyKey(request);

    if (!key) {
      return next.handle();
    }

    const requestHash = hashRequestBody(request.body);

    return from(this.claim(metadata.scope, key, requestHash)).pipe(
      mergeMap((claim) => {
        if (claim.kind === 'replay') {
          response.status(claim.status);
          return of(claim.body);
        }

        return next.handle().pipe(
          mergeMap((value: unknown) =>
            from(
              this.storeResponse(
                metadata.scope,
                key,
                response.statusCode,
                value,
              ),
            ).pipe(map(() => value)),
          ),
          catchError((error: unknown) =>
            from(this.releaseClaim(metadata.scope, key)).pipe(
              mergeMap(() => throwError(() => error)),
            ),
          ),
        );
      }),
    );
  }

  private async claim(
    scope: string,
    key: string,
    requestHash: string,
  ): Promise<ClaimResult> {
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          scope,
          key,
          requestHash,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
      return { kind: 'claimed' };
    } catch (error: unknown) {
      if (!hasPrismaCode(error, 'P2002')) {
        throw error;
      }

      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { scope_key: { scope, key } },
      });

      if (!existing) {
        throw error;
      }

      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
        );
      }

      if (existing.responseStatus === null) {
        throw new ConflictException('IDEMPOTENCY_KEY_IN_PROGRESS');
      }

      return {
        kind: 'replay',
        status: existing.responseStatus,
        body: existing.responseBody,
      };
    }
  }

  private async storeResponse(
    scope: string,
    key: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> {
    const jsonBody = toJsonValue(responseBody);
    await this.prisma.idempotencyKey.update({
      where: { scope_key: { scope, key } },
      data: {
        responseStatus,
        responseBody: jsonBody === null ? Prisma.JsonNull : jsonBody,
      },
    });
  }

  private async releaseClaim(scope: string, key: string): Promise<void> {
    try {
      await this.prisma.idempotencyKey.delete({
        where: { scope_key: { scope, key } },
      });
    } catch (error: unknown) {
      if (!hasPrismaCode(error, 'P2025')) {
        throw error;
      }
    }
  }
}

function readIdempotencyKey(request: Request): string | undefined {
  const header = request.headers[IDEMPOTENCY_KEY_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value)) ?? 'null';
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const nested = value[key];
        if (nested !== undefined) {
          accumulator[key] = sortJson(nested);
        }
        return accumulator;
      }, {});
  }

  return value;
}

function toJsonValue(value: unknown): JsonInput {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    return null;
  }

  const parsed = JSON.parse(serialized) as unknown;
  return toInputJsonValue(parsed);
}

function toInputJsonValue(value: unknown): JsonInput {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toInputJsonValue);
  }

  if (isRecord(value)) {
    const output: Record<string, JsonInput> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) {
        output[key] = toInputJsonValue(nested);
      }
    }
    return output;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
