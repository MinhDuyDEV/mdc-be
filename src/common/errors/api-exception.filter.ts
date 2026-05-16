import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { type ApiErrorResponse } from './error-response.types';

interface ErrorResponseRequest {
  headers?: Record<string, string | string[] | undefined>;
  id?: string;
}

interface ErrorResponseReply {
  status(code: number): ErrorResponseReply;
  json(body: ApiErrorResponse): void;
}

function normalizeDetails(response: string | object): { message: string; details?: unknown; code?: string } {
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

  return {
    message,
    details: responseRecord,
    code: typeof rawError === 'string' ? rawError.toUpperCase().replaceAll(' ', '_') : undefined,
  };
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
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<ErrorResponseReply>();
    const request = http.getRequest<ErrorResponseRequest>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = exception instanceof HttpException
      ? normalizeDetails(exception.getResponse())
      : { message: 'Internal server error' };

    const body: ApiErrorResponse = {
      error: {
        code: normalized.code ?? HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR',
        message: normalized.message,
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
        ...(getRequestId(request) === undefined ? {} : { requestId: getRequestId(request) }),
      },
    };

    response.status(status).json(body);
  }
}
