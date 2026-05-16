import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import {
  type ApiSuccessResponse,
  createApiResponse,
  isApiSuccessResponse,
} from './api-response.types';

const BYPASS_PATHS = new Set(['/', '/health/live', '/health/ready']);

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ url?: string; path?: string }>();
    const requestPath = request.path ?? request.url?.split('?')[0] ?? '';

    if (BYPASS_PATHS.has(requestPath)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((value: unknown): ApiSuccessResponse => {
        if (isApiSuccessResponse(value)) {
          return value;
        }

        return createApiResponse(value);
      }),
    );
  }
}
