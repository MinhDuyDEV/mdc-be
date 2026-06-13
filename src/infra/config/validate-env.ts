import type { AppConfig, ProcessRole } from './app-config';

const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);
const BODY_LIMIT_PATTERN = /^\d+(b|kb|mb)$/i;
const VALID_PROCESS_ROLES = new Set<ProcessRole>([
  'api',
  'worker',
  'realtime',
  'all',
]);

export type RawEnv = Record<string, string | undefined>;

function requireString(env: RawEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function parseOptionalString(env: RawEnv, key: string): string {
  return env[key]?.trim() ?? '';
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parsePositiveInteger(env: RawEnv, key: string): number {
  const value = Number(requireString(env, key));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
}

function parseOptionalPositiveInteger(
  env: RawEnv,
  key: string,
  defaultVal: number,
): number {
  const raw = env[key]?.trim();
  if (raw === undefined || raw === '') return defaultVal;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
}

function parseBoolean(env: RawEnv, key: string): boolean {
  const value = requireString(env, key).toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${key} must be "true" or "false"`);
}

function parseBodyLimit(env: RawEnv, key: string): string {
  const value = requireString(env, key);
  if (!BODY_LIMIT_PATTERN.test(value)) {
    throw new Error(`${key} must use a size suffix like 1mb, 512kb, or 1024b`);
  }

  return value;
}

function parseCorsOrigins(raw: string): string[] {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must include at least one origin');
  }

  return origins;
}

function parseCookieSameSite(
  env: RawEnv,
  key: string,
): 'strict' | 'lax' | 'none' {
  const value = env[key]?.toLowerCase();
  if (value === 'strict' || value === 'lax' || value === 'none') {
    return value;
  }
  return 'lax'; // default
}

function parseProcessRole(value: string | undefined): ProcessRole {
  const role = value ?? 'all';
  if (!VALID_PROCESS_ROLES.has(role as ProcessRole)) {
    throw new Error(
      `APP_PROCESS_ROLE must be one of: api, worker, realtime, all (got: ${role})`,
    );
  }

  return role as ProcessRole;
}

function parseCommaSeparatedString(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function validateEnv(env: RawEnv): AppConfig {
  const nodeEnv = requireString(env, 'NODE_ENV');
  if (!VALID_NODE_ENVS.has(nodeEnv)) {
    throw new Error('NODE_ENV must be one of development, test, production');
  }

  return {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    port: parsePort(requireString(env, 'PORT')),
    corsOrigins: parseCorsOrigins(requireString(env, 'CORS_ORIGINS')),
    bodyJsonLimit: parseBodyLimit(env, 'BODY_JSON_LIMIT'),
    bodyUrlencodedLimit: parseBodyLimit(env, 'BODY_URLENCODED_LIMIT'),
    databaseUrl: requireString(env, 'DATABASE_URL'),
    prismaTransactionMaxWaitMs: parseOptionalPositiveInteger(
      env,
      'PRISMA_TRANSACTION_MAX_WAIT_MS',
      5000,
    ),
    prismaTransactionTimeoutMs: parseOptionalPositiveInteger(
      env,
      'PRISMA_TRANSACTION_TIMEOUT_MS',
      15000,
    ),
    redisUrl: requireString(env, 'REDIS_URL'),
    healthDatabaseTimeoutMs: parsePositiveInteger(
      env,
      'HEALTH_DATABASE_TIMEOUT_MS',
    ),
    healthRedisTimeoutMs: parsePositiveInteger(env, 'HEALTH_REDIS_TIMEOUT_MS'),
    // S3 / MinIO
    s3Endpoint: requireString(env, 'S3_ENDPOINT'),
    s3Region: requireString(env, 'S3_REGION'),
    s3AccessKeyId: requireString(env, 'S3_ACCESS_KEY_ID'),
    s3SecretAccessKey: requireString(env, 'S3_SECRET_ACCESS_KEY'),
    s3Bucket: requireString(env, 'S3_BUCKET'),
    s3ForcePathStyle: parseBoolean(env, 'S3_FORCE_PATH_STYLE'),
    healthS3TimeoutMs: parsePositiveInteger(env, 'HEALTH_S3_TIMEOUT_MS'),
    // Elasticsearch
    elasticsearchNode: requireString(env, 'ELASTICSEARCH_NODE'),
    healthElasticsearchTimeoutMs: parsePositiveInteger(
      env,
      'HEALTH_ELASTICSEARCH_TIMEOUT_MS',
    ),
    // SMTP (host, user, pass are optional in dev for streamTransport fallback)
    smtpHost: parseOptionalString(env, 'SMTP_HOST'),
    smtpPort: parsePort(requireString(env, 'SMTP_PORT')),
    smtpSecure: parseBoolean(env, 'SMTP_SECURE'),
    smtpUser: parseOptionalString(env, 'SMTP_USER'),
    smtpPass: parseOptionalString(env, 'SMTP_PASS'),
    emailFrom: requireString(env, 'EMAIL_FROM'),
    healthMailerTimeoutMs: parsePositiveInteger(
      env,
      'HEALTH_MAILER_TIMEOUT_MS',
    ),
    // OpenTelemetry
    otelServiceName: requireString(env, 'OTEL_SERVICE_NAME'),
    otelExporterOtlpEndpoint: requireString(env, 'OTEL_EXPORTER_OTLP_ENDPOINT'),
    // Process role
    appProcessRole: parseProcessRole(env.APP_PROCESS_ROLE),
    // Outbox (all with sensible defaults)
    outboxBatchSize: parseOptionalPositiveInteger(env, 'OUTBOX_BATCH_SIZE', 20),
    outboxMaxRetries: parseOptionalPositiveInteger(
      env,
      'OUTBOX_MAX_RETRIES',
      5,
    ),
    outboxBaseBackoffMs: parseOptionalPositiveInteger(
      env,
      'OUTBOX_BASE_BACKOFF_MS',
      1000,
    ),
    outboxMaxBackoffMs: parseOptionalPositiveInteger(
      env,
      'OUTBOX_MAX_BACKOFF_MS',
      60000,
    ),
    outboxLeaseTimeoutMs: parseOptionalPositiveInteger(
      env,
      'OUTBOX_LEASE_TIMEOUT_MS',
      60000,
    ),
    outboxHealthLagThreshold: parseOptionalPositiveInteger(
      env,
      'OUTBOX_HEALTH_LAG_THRESHOLD',
      100,
    ),
    // JWT Authentication
    jwtAccessSecret: requireString(env, 'JWT_ACCESS_SECRET'),
    jwtAccessExpiresIn:
      parseOptionalString(env, 'JWT_ACCESS_EXPIRES_IN') || '15m',
    jwtRefreshExpiresIn:
      parseOptionalString(env, 'JWT_REFRESH_EXPIRES_IN') || '7d',
    // Cookie Configuration
    cookieSecret: requireString(env, 'COOKIE_SECRET'),
    cookieSecure: parseBoolean(env, 'COOKIE_SECURE'),
    cookieSameSite: parseCookieSameSite(env, 'COOKIE_SAME_SITE'),
    // Rate Limiting
    throttleLoginLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_LOGIN_LIMIT',
      5,
    ),
    throttleLoginTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_LOGIN_TTL',
      60000,
    ),
    throttleRegisterLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REGISTER_LIMIT',
      3,
    ),
    throttleRegisterTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REGISTER_TTL',
      60000,
    ),
    throttlePasswordResetLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_PASSWORD_RESET_LIMIT',
      3,
    ),
    throttlePasswordResetTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_PASSWORD_RESET_TTL',
      300000,
    ),
    throttleResendVerificationLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_RESEND_VERIFICATION_LIMIT',
      1,
    ),
    throttleResendVerificationTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_RESEND_VERIFICATION_TTL',
      60000,
    ),
    throttleRefreshLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REFRESH_LIMIT',
      10,
    ),
    throttleRefreshTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REFRESH_TTL',
      60000,
    ),
    // Content creation rate limiting
    throttlePostCreateLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_POST_CREATE_LIMIT',
      5,
    ),
    throttlePostCreateTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_POST_CREATE_TTL',
      60000,
    ),
    throttleCommentCreateLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_COMMENT_CREATE_LIMIT',
      10,
    ),
    throttleCommentCreateTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_COMMENT_CREATE_TTL',
      60000,
    ),
    throttleReactionCreateLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REACTION_CREATE_LIMIT',
      30,
    ),
    throttleReactionCreateTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REACTION_CREATE_TTL',
      60000,
    ),
    throttleMessageSendLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_MESSAGE_SEND_LIMIT',
      30,
    ),
    throttleMessageSendTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_MESSAGE_SEND_TTL',
      60000,
    ),
    throttleReportCreateLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REPORT_CREATE_LIMIT',
      10,
    ),
    throttleReportCreateTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_REPORT_CREATE_TTL',
      60000,
    ),
    throttleProfileUpdateLimit: parseOptionalPositiveInteger(
      env,
      'THROTTLE_PROFILE_UPDATE_LIMIT',
      10,
    ),
    throttleProfileUpdateTtl: parseOptionalPositiveInteger(
      env,
      'THROTTLE_PROFILE_UPDATE_TTL',
      60000,
    ),
    // Media upload
    mediaAvatarMaxSizeBytes: parseOptionalPositiveInteger(
      env,
      'MEDIA_AVATAR_MAX_SIZE_BYTES',
      5_242_880, // 5MB
    ),
    mediaResumeMaxSizeBytes: parseOptionalPositiveInteger(
      env,
      'MEDIA_RESUME_MAX_SIZE_BYTES',
      20_971_520, // 20MB
    ),
    mediaAllowedContentTypes: parseCommaSeparatedString(
      parseOptionalString(env, 'MEDIA_ALLOWED_CONTENT_TYPES') ||
        'image/jpeg,image/png,image/gif,image/webp,application/pdf',
    ),
    // Billing
    billingProvider: parseOptionalString(env, 'BILLING_PROVIDER') || 'mock',
    billingWebhookSecret: requireString(env, 'BILLING_WEBHOOK_SECRET'),
    billingDefaultFreePlanSlug:
      parseOptionalString(env, 'BILLING_DEFAULT_FREE_PLAN_SLUG') || 'free',
    // Stripe
    stripeEnabled: parseOptionalString(env, 'STRIPE_ENABLED') === 'true',
    stripeSecretKey: (() => {
      const val = parseOptionalString(env, 'STRIPE_SECRET_KEY');
      if (env.STRIPE_ENABLED === 'true' && !val) {
        throw new Error(
          'STRIPE_SECRET_KEY is required when STRIPE_ENABLED=true',
        );
      }
      return val;
    })(),
    stripeWebhookSecret: (() => {
      const val = parseOptionalString(env, 'STRIPE_WEBHOOK_SECRET');
      if (env.STRIPE_ENABLED === 'true' && !val) {
        throw new Error(
          'STRIPE_WEBHOOK_SECRET is required when STRIPE_ENABLED=true',
        );
      }
      return val;
    })(),
    stripeApiVersion:
      parseOptionalString(env, 'STRIPE_API_VERSION') || '2024-12-18.acacia',
    // Push notifications (FCM/APNs) — all optional, disabled by default
    fcmEnabled: parseOptionalString(env, 'FCM_ENABLED') === 'true',
    fcmServiceAccountPath: parseOptionalString(env, 'FCM_SERVICE_ACCOUNT_PATH'),
    apnsEnabled: parseOptionalString(env, 'APNS_ENABLED') === 'true',
    apnsTeamId: parseOptionalString(env, 'APNS_TEAM_ID'),
    apnsKeyId: parseOptionalString(env, 'APNS_KEY_ID'),
    apnsSigningKeyPath: parseOptionalString(env, 'APNS_SIGNING_KEY_PATH'),
    apnsBundleId: parseOptionalString(env, 'APNS_BUNDLE_ID'),
    apnsProduction: parseOptionalString(env, 'APNS_PRODUCTION') === 'true',
    // Feature flags (Unleash) — optional, disabled by default
    unleashEnabled: parseOptionalString(env, 'UNLEASH_ENABLED') !== 'false',
    unleashUrl:
      parseOptionalString(env, 'UNLEASH_URL') || 'http://localhost:4242/api',
    unleashApiToken: parseOptionalString(env, 'UNLEASH_API_TOKEN') ?? '',
    unleashAppName: parseOptionalString(env, 'UNLEASH_APP_NAME') || 'mdc-be',
    // Virus scan (Phase E T2) — optional, disabled by default
    virusScanEnabled: parseOptionalString(env, 'VIRUS_SCAN_ENABLED') === 'true',
    clamavHost: parseOptionalString(env, 'CLAMAV_HOST') ?? 'localhost',
    clamavPort: parseOptionalPositiveInteger(env, 'CLAMAV_PORT', 3310),
    // GDPR
    gdprExportRetentionDays: parseOptionalPositiveInteger(
      env,
      'GDPR_EXPORT_RETENTION_DAYS',
      7,
    ),
    gdprGracePeriodDays: parseOptionalPositiveInteger(
      env,
      'GDPR_GRACE_PERIOD_DAYS',
      7,
    ),
    gdprSlaDays: parseOptionalPositiveInteger(env, 'GDPR_SLA_DAYS', 30),
    // Email tracking (CNIL)
    emailTrackingBaseUrl:
      parseOptionalString(env, 'EMAIL_TRACKING_BASE_URL') ||
      'http://localhost:3000',
    // Email unsubscribe HMAC secret. Required in production (otherwise an
    // attacker could forge unsubscribe tokens for arbitrary userIds).
    // In dev/test we fall back to a clearly-marked placeholder so local
    // developers don't have to configure it, but the app refuses to
    // start in production with the placeholder.
    emailUnsubscribeSecret: (() => {
      const provided = parseOptionalString(env, 'EMAIL_UNSUBSCRIBE_SECRET');
      const isPlaceholder = !provided || provided === 'change-me-in-production';
      if (isPlaceholder && nodeEnv === 'production') {
        throw new Error(
          'EMAIL_UNSUBSCRIBE_SECRET is required in production (used to sign unsubscribe tokens).',
        );
      }
      return provided || 'dev-only-change-me-in-production';
    })(),
  };
}
