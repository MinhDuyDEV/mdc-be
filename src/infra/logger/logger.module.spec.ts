import { Writable } from 'node:stream';
import pino from 'pino';

import { REDACTION_PATHS } from './logger.module';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCaptureLogger(): {
  logger: pino.Logger;
  lastLog: () => Record<string, unknown>;
} {
  const lines: string[] = [];

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString().trim());
      callback();
    },
  });

  const logger = pino(
    {
      level: 'trace',
      redact: { paths: REDACTION_PATHS, censor: '[REDACTED]' },
    },
    stream,
  );

  return {
    logger,
    lastLog: () => {
      const raw = lines.at(-1);
      if (!raw) throw new Error('No log output captured');
      return JSON.parse(raw) as Record<string, unknown>;
    },
  };
}

function bodyOf(log: Record<string, unknown>): Record<string, unknown> {
  return (log['req'] as Record<string, unknown>)['body'] as Record<
    string,
    unknown
  >;
}

function headersOf(log: Record<string, unknown>): Record<string, unknown> {
  return (log['req'] as Record<string, unknown>)['headers'] as Record<
    string,
    unknown
  >;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REDACTION_PATHS — Pino redaction coverage', () => {
  let logger: pino.Logger;
  let lastLog: () => Record<string, unknown>;

  beforeEach(() => {
    ({ logger, lastLog } = createCaptureLogger());
  });

  // ── Existing auth paths ──────────────────────────────────────────────────

  describe('existing auth paths still redact', () => {
    it('redacts req.headers.authorization', () => {
      logger.info({
        req: { headers: { authorization: 'Bearer secret-token' }, body: {} },
      });
      expect(headersOf(lastLog())['authorization']).toBe('[REDACTED]');
    });

    it('redacts req.headers.cookie', () => {
      logger.info({ req: { headers: { cookie: 'session=abc123' }, body: {} } });
      expect(headersOf(lastLog())['cookie']).toBe('[REDACTED]');
    });

    it('redacts req.body.password', () => {
      logger.info({ req: { headers: {}, body: { password: 'supersecret' } } });
      expect(bodyOf(lastLog())['password']).toBe('[REDACTED]');
    });

    it('redacts req.body.token', () => {
      logger.info({ req: { headers: {}, body: { token: 'tok' } } });
      expect(bodyOf(lastLog())['token']).toBe('[REDACTED]');
    });

    it('redacts req.body.refreshToken', () => {
      logger.info({ req: { headers: {}, body: { refreshToken: 'rt' } } });
      expect(bodyOf(lastLog())['refreshToken']).toBe('[REDACTED]');
    });

    it('redacts req.body.accessToken', () => {
      logger.info({ req: { headers: {}, body: { accessToken: 'at' } } });
      expect(bodyOf(lastLog())['accessToken']).toBe('[REDACTED]');
    });
  });

  // ── Phase 4 PII — req.body fields ────────────────────────────────────────

  describe('Phase 4 PII — req.body fields', () => {
    it('redacts req.body.coverLetter', () => {
      logger.info({
        req: { headers: {}, body: { coverLetter: 'Dear Hiring Manager…' } },
      });
      expect(bodyOf(lastLog())['coverLetter']).toBe('[REDACTED]');
    });

    it('redacts req.body.screeningAnswers (whole array)', () => {
      logger.info({
        req: {
          headers: {},
          body: { screeningAnswers: [{ question: 'q1', answer: 'yes' }] },
        },
      });
      expect(bodyOf(lastLog())['screeningAnswers']).toBe('[REDACTED]');
    });

    it('redacts req.body.note', () => {
      logger.info({ req: { headers: {}, body: { note: 'candidate note' } } });
      expect(bodyOf(lastLog())['note']).toBe('[REDACTED]');
    });

    it('redacts req.body.notes', () => {
      logger.info({ req: { headers: {}, body: { notes: 'multiple notes' } } });
      expect(bodyOf(lastLog())['notes']).toBe('[REDACTED]');
    });

    it('redacts req.body.resume', () => {
      logger.info({ req: { headers: {}, body: { resume: 'base64data==' } } });
      expect(bodyOf(lastLog())['resume']).toBe('[REDACTED]');
    });

    it('redacts req.body.resumeBytes', () => {
      logger.info({ req: { headers: {}, body: { resumeBytes: 'rawbytes' } } });
      expect(bodyOf(lastLog())['resumeBytes']).toBe('[REDACTED]');
    });

    it('redacts req.body.message', () => {
      logger.info({
        req: { headers: {}, body: { message: 'recruiter outreach text' } },
      });
      expect(bodyOf(lastLog())['message']).toBe('[REDACTED]');
    });
  });

  // ── Phase 4 PII — wildcard paths ─────────────────────────────────────────

  describe('Phase 4 PII — wildcard paths (one level deep)', () => {
    it('redacts *.coverLetter', () => {
      logger.info({ application: { coverLetter: 'Dear Hiring Manager…' } });
      const nested = lastLog()['application'] as Record<string, unknown>;
      expect(nested['coverLetter']).toBe('[REDACTED]');
    });

    it('redacts *.screeningAnswers', () => {
      logger.info({ application: { screeningAnswers: [{ answer: 'yes' }] } });
      const nested = lastLog()['application'] as Record<string, unknown>;
      expect(nested['screeningAnswers']).toBe('[REDACTED]');
    });

    it('redacts *.candidateNote', () => {
      logger.info({ review: { candidateNote: 'private note' } });
      const nested = lastLog()['review'] as Record<string, unknown>;
      expect(nested['candidateNote']).toBe('[REDACTED]');
    });

    it('redacts *.applicationNote', () => {
      logger.info({ review: { applicationNote: 'reviewer note' } });
      const nested = lastLog()['review'] as Record<string, unknown>;
      expect(nested['applicationNote']).toBe('[REDACTED]');
    });
  });

  // ── Non-sensitive fields are NOT redacted ─────────────────────────────────

  describe('non-sensitive fields are NOT redacted', () => {
    it('preserves req.body.email', () => {
      logger.info({
        req: { headers: {}, body: { email: 'user@example.com' } },
      });
      expect(bodyOf(lastLog())['email']).toBe('user@example.com');
    });

    it('preserves req.body.name', () => {
      logger.info({ req: { headers: {}, body: { name: 'Jane Doe' } } });
      expect(bodyOf(lastLog())['name']).toBe('Jane Doe');
    });

    it('preserves req.headers.content-type', () => {
      logger.info({
        req: { headers: { 'content-type': 'application/json' }, body: {} },
      });
      expect(headersOf(lastLog())['content-type']).toBe('application/json');
    });

    it('preserves non-sensitive top-level fields', () => {
      logger.info({ userId: 'u-123', action: 'login' });
      const log = lastLog();
      expect(log['userId']).toBe('u-123');
      expect(log['action']).toBe('login');
    });
  });
});
