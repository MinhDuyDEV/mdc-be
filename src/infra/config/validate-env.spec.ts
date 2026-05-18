import { type RawEnv, validateEnv } from './validate-env';

const validEnv: RawEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
  BODY_JSON_LIMIT: '1mb',
  BODY_URLENCODED_LIMIT: '1mb',
  DATABASE_URL:
    'postgresql://mdc:mdc_dev_password@localhost:5432/mdc?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  HEALTH_DATABASE_TIMEOUT_MS: '1000',
  HEALTH_REDIS_TIMEOUT_MS: '1000',
  // S3 / MinIO
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_BUCKET: 'mdc-media',
  S3_FORCE_PATH_STYLE: 'true',
  HEALTH_S3_TIMEOUT_MS: '3000',
  // Elasticsearch
  ELASTICSEARCH_NODE: 'http://localhost:9200',
  HEALTH_ELASTICSEARCH_TIMEOUT_MS: '5000',
  // SMTP
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'user@example.com',
  SMTP_PASS: 'password123',
  EMAIL_FROM: 'noreply@mdc.local',
  HEALTH_MAILER_TIMEOUT_MS: '3000',
  // OpenTelemetry
  OTEL_SERVICE_NAME: 'mdc-be-test',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
};

describe('validateEnv', () => {
  it('returns typed config for valid env input', () => {
    expect(validateEnv(validEnv)).toEqual({
      nodeEnv: 'development',
      port: 3000,
      corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      bodyJsonLimit: '1mb',
      bodyUrlencodedLimit: '1mb',
      databaseUrl: validEnv.DATABASE_URL,
      redisUrl: validEnv.REDIS_URL,
      healthDatabaseTimeoutMs: 1000,
      healthRedisTimeoutMs: 1000,
      s3Endpoint: 'http://localhost:9000',
      s3Region: 'us-east-1',
      s3AccessKeyId: 'minioadmin',
      s3SecretAccessKey: 'minioadmin',
      s3Bucket: 'mdc-media',
      s3ForcePathStyle: true,
      healthS3TimeoutMs: 3000,
      elasticsearchNode: 'http://localhost:9200',
      healthElasticsearchTimeoutMs: 5000,
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'user@example.com',
      smtpPass: 'password123',
      emailFrom: 'noreply@mdc.local',
      healthMailerTimeoutMs: 3000,
      otelServiceName: 'mdc-be-test',
      otelExporterOtlpEndpoint: 'http://localhost:4318',
      appProcessRole: 'all',
      outboxPollIntervalMs: 5000,
      outboxBatchSize: 20,
      outboxMaxRetries: 5,
      outboxBaseBackoffMs: 1000,
      outboxMaxBackoffMs: 60000,
      outboxLeaseTimeoutMs: 60000,
      outboxHealthLagThreshold: 100,
    });
  });

  it.each([
    'DATABASE_URL',
    'REDIS_URL',
    'PORT',
    'BODY_JSON_LIMIT',
    'CORS_ORIGINS',
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'ELASTICSEARCH_NODE',
    'EMAIL_FROM',
    'OTEL_SERVICE_NAME',
    'OTEL_EXPORTER_OTLP_ENDPOINT',
  ])('throws when %s is missing', (key) => {
    const env = { ...validEnv, [key]: undefined };
    expect(() => validateEnv(env)).toThrow();
  });

  it('throws for invalid port, body limit, and empty CORS config', () => {
    expect(() => validateEnv({ ...validEnv, PORT: '70000' })).toThrow(
      'PORT must be',
    );
    expect(() => validateEnv({ ...validEnv, BODY_JSON_LIMIT: 'huge' })).toThrow(
      'BODY_JSON_LIMIT',
    );
    expect(() => validateEnv({ ...validEnv, CORS_ORIGINS: '  ' })).toThrow(
      'CORS_ORIGINS',
    );
  });

  it('throws when S3_FORCE_PATH_STYLE is not a valid boolean', () => {
    expect(() =>
      validateEnv({ ...validEnv, S3_FORCE_PATH_STYLE: 'yes' }),
    ).toThrow('S3_FORCE_PATH_STYLE');
  });

  it('allows empty SMTP_HOST, SMTP_USER, SMTP_PASS for dev fallback', () => {
    const result = validateEnv({
      ...validEnv,
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
    });
    expect(result.smtpHost).toBe('');
    expect(result.smtpUser).toBe('');
    expect(result.smtpPass).toBe('');
  });

  describe('APP_PROCESS_ROLE', () => {
    it('should accept valid process roles', () => {
      for (const role of ['api', 'worker', 'realtime', 'all']) {
        expect(() =>
          validateEnv({ ...validEnv, APP_PROCESS_ROLE: role }),
        ).not.toThrow();
      }
    });

    it('should reject invalid process roles', () => {
      expect(() =>
        validateEnv({ ...validEnv, APP_PROCESS_ROLE: 'invalid' }),
      ).toThrow(/APP_PROCESS_ROLE/);
    });

    it("should default to 'all' when unset", () => {
      const config = validateEnv(validEnv);
      expect(config.appProcessRole).toBe('all');
    });

    it('should parse explicit process role', () => {
      const config = validateEnv({ ...validEnv, APP_PROCESS_ROLE: 'worker' });
      expect(config.appProcessRole).toBe('worker');
    });
  });

  describe('Outbox config', () => {
    it('should parse outbox poll interval', () => {
      const config = validateEnv({
        ...validEnv,
        OUTBOX_POLL_INTERVAL_MS: '10000',
      });
      expect(config.outboxPollIntervalMs).toBe(10000);
    });

    it('should default all outbox config when unset', () => {
      const config = validateEnv(validEnv);
      expect(config.outboxPollIntervalMs).toBe(5000);
      expect(config.outboxBatchSize).toBe(20);
      expect(config.outboxMaxRetries).toBe(5);
      expect(config.outboxBaseBackoffMs).toBe(1000);
      expect(config.outboxMaxBackoffMs).toBe(60000);
      expect(config.outboxLeaseTimeoutMs).toBe(60000);
      expect(config.outboxHealthLagThreshold).toBe(100);
    });

    it('should parse all outbox env vars', () => {
      const config = validateEnv({
        ...validEnv,
        OUTBOX_POLL_INTERVAL_MS: '3000',
        OUTBOX_BATCH_SIZE: '50',
        OUTBOX_MAX_RETRIES: '10',
        OUTBOX_BASE_BACKOFF_MS: '2000',
        OUTBOX_MAX_BACKOFF_MS: '120000',
        OUTBOX_LEASE_TIMEOUT_MS: '30000',
        OUTBOX_HEALTH_LAG_THRESHOLD: '200',
      });
      expect(config.outboxPollIntervalMs).toBe(3000);
      expect(config.outboxBatchSize).toBe(50);
      expect(config.outboxMaxRetries).toBe(10);
      expect(config.outboxBaseBackoffMs).toBe(2000);
      expect(config.outboxMaxBackoffMs).toBe(120000);
      expect(config.outboxLeaseTimeoutMs).toBe(30000);
      expect(config.outboxHealthLagThreshold).toBe(200);
    });
  });
});
