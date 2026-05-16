import { INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  createValidationPipe,
} from './common';
import { type AppConfig } from './infra';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(helmet());
  app.use(json({ limit: configService.get('bodyJsonLimit', { infer: true }) }));
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
