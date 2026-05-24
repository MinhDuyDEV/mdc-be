import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

/**
 * Pino redaction paths covering auth credentials and Phase 4 PII fields
 * (application cover letters, screening answers, candidate notes, resume bytes,
 * recruiter messages). Exported so tests can verify the same config in isolation.
 */
export const REDACTION_PATHS: string[] = [
  // Auth headers
  'req.headers.authorization',
  'req.headers.cookie',
  // Auth body fields
  'req.body.password',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.accessToken',
  // Phase 4 PII — application / recruiting
  'req.body.coverLetter',
  'req.body.screeningAnswers',
  'req.body.screeningAnswers[*].answer',
  'req.body.note',
  'req.body.notes',
  'req.body.resume',
  'req.body.resumeBytes',
  'req.body.message',
  // Depth-2 request-body objects, e.g. application payload wrappers.
  'req.body.*.coverLetter',
  'req.body.*.screeningAnswers[*].answer',
  'req.body.*.candidateNote',
  'req.body.*.applicationNote',
  'req.body.*.note',
  'req.body.*.notes',
  'req.body.*.resume',
  'req.body.*.resumeBytes',
  'req.body.*.message',
  // Wildcard patterns for one-level-deep nested objects
  '*.coverLetter',
  '*.screeningAnswers',
  '*.candidateNote',
  '*.applicationNote',
];

export function resolveRequestId(
  header: string | string[] | undefined,
): string {
  const requestId = Array.isArray(header) ? header[0] : header;
  return requestId ?? randomUUID();
}

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const requestId = resolveRequestId(req.headers['x-request-id']);
          res.setHeader('x-request-id', requestId);
          return requestId;
        },
        customProps: () => ({
          context: 'HTTP',
        }),
        redact: {
          paths: REDACTION_PATHS,
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
