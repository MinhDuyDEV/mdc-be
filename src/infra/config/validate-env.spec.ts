import { validateEnv, type RawEnv } from './validate-env';

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
    });
  });

  it.each([
    'DATABASE_URL',
    'REDIS_URL',
    'PORT',
    'BODY_JSON_LIMIT',
    'CORS_ORIGINS',
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
});
