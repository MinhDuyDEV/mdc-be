import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        genReqId: () => randomUUID(),
        customProps: () => ({
          context: 'HTTP',
        }),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.token',
            'req.body.refreshToken',
            'req.body.accessToken',
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req: (req: IncomingMessage & { id?: string }) => ({
            id: req.id ?? '',
            method: req.method ?? '',
            url: req.url ?? '',
          }),
          res: (res: ServerResponse & { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
        },
        customSuccessMessage: (
          req: IncomingMessage,
          res: ServerResponse & { statusCode: number },
        ) => {
          return `${req.method ?? ''} ${req.url ?? ''} ${res.statusCode}`;
        },
        customErrorMessage: (
          req: IncomingMessage,
          res: ServerResponse & { statusCode: number },
        ) => {
          return `${req.method ?? ''} ${req.url ?? ''} ${res.statusCode}`;
        },
        customAttributeKeys: {
          req: 'request',
          res: 'response',
          err: 'error',
          responseTime: 'responseTime',
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
