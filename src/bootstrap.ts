import { type INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  json,
  type NextFunction,
  type Request,
  type Response,
  urlencoded,
} from 'express';
import helmet from 'helmet';
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  createValidationPipe,
} from './common';
import type { AppConfig } from './infra';
import { resolveRequestId } from './infra/logger/logger.module';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts:
        configService.get('nodeEnv', { infer: true }) === 'production'
          ? { maxAge: 63072000, includeSubDomains: true, preload: true }
          : false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hidePoweredBy: true,
    }),
  );
  app.use(
    json({
      limit: configService.get('bodyJsonLimit', { infer: true }),
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: configService.get('bodyUrlencodedLimit', { infer: true }),
    }),
  );
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.enableCors({
    origin: configService.get('corsOrigins', { infer: true }),
    credentials: true,
    maxAge: 86400,
  });

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const loggerRequestId = typeof req.id === 'string' ? req.id : undefined;
    const requestId =
      loggerRequestId ?? resolveRequestId(req.headers['x-request-id']);
    req.id = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableShutdownHooks();
}
