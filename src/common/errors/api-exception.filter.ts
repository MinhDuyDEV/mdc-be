import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorResponse } from './error-response.types';

interface ErrorResponseRequest {
  headers?: Record<string, string | string[] | undefined>;
  id?: string;
}

interface ErrorResponseReply {
  status(code: number): ErrorResponseReply;
  json(body: ApiErrorResponse): void;
}

interface ExceptionLogger {
  error(message: string, trace?: string): void;
}

function normalizeDetails(response: string | object): {
  message: string;
  details?: unknown;
  code?: string;
} {
  if (typeof response === 'string') {
    return { message: response };
  }

  const responseRecord = response as Record<string, unknown>;
  const rawMessage = responseRecord.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : 'Request failed';
  const rawError = responseRecord.error;
  const rawCode = responseRecord.code;

  return {
    message,
    details:
      typeof rawCode === 'string' ? responseRecord.details : responseRecord,
    code:
      typeof rawCode === 'string'
        ? rawCode
        : typeof rawError === 'string'
          ? rawError.toUpperCase().replaceAll(' ', '_')
          : undefined,
  };
}

function isHttpErrorLike(
  exception: unknown,
): exception is { status?: number; statusCode?: number; message?: string } {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    ('status' in exception || 'statusCode' in exception)
  );
}

function getHttpErrorStatus(exception: {
  status?: number;
  statusCode?: number;
}): number {
  return (
    exception.statusCode ?? exception.status ?? HttpStatus.INTERNAL_SERVER_ERROR
  );
}

function getRequestId(request: ErrorResponseRequest): string | undefined {
  const rawHeader = request.headers?.['x-request-id'];
  if (Array.isArray(rawHeader)) {
    return rawHeader[0];
  }

  return rawHeader ?? request.id;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: ExceptionLogger = new Logger(
      ApiExceptionFilter.name,
    ),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<ErrorResponseReply>();
    const request = http.getRequest<ErrorResponseRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isHttpErrorLike(exception)
          ? getHttpErrorStatus(exception)
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized =
      exception instanceof HttpException
        ? normalizeDetails(exception.getResponse())
        : isHttpErrorLike(exception)
          ? {
              code: HttpStatus[status] ?? 'HTTP_ERROR',
              message: exception.message ?? 'Request failed',
            }
          : { message: 'Internal server error' };

    const requestId = getRequestId(request);
    if (!(exception instanceof HttpException) && status >= 500) {
      const trace = exception instanceof Error ? exception.stack : undefined;
      const suffix = requestId === undefined ? '' : ` requestId=${requestId}`;
      this.logger.error(
        `Unhandled exception normalized to 500.${suffix}`,
        trace,
      );
    }

    const body: ApiErrorResponse = {
      error: {
        code: normalized.code ?? HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR',
        message: normalized.message,
        ...(normalized.details === undefined
          ? {}
          : { details: normalized.details }),
        ...(requestId === undefined ? {} : { requestId }),
      },
    };

    response.status(status).json(body);
  }
}
