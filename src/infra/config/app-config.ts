export type ProcessRole = 'api' | 'worker' | 'realtime' | 'all';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  bodyJsonLimit: string;
  bodyUrlencodedLimit: string;
  databaseUrl: string;
  redisUrl: string;
  healthDatabaseTimeoutMs: number;
  healthRedisTimeoutMs: number;
  // S3 / MinIO
  s3Endpoint: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Bucket: string;
  s3ForcePathStyle: boolean;
  healthS3TimeoutMs: number;
  // Elasticsearch
  elasticsearchNode: string;
  healthElasticsearchTimeoutMs: number;
  // SMTP
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  healthMailerTimeoutMs: number;
  // OpenTelemetry
  otelServiceName: string;
  otelExporterOtlpEndpoint: string;
  // Process role
  appProcessRole: ProcessRole;
  // Outbox
  outboxBatchSize: number;
  outboxMaxRetries: number;
  outboxBaseBackoffMs: number;
  outboxMaxBackoffMs: number;
  outboxLeaseTimeoutMs: number;
  outboxHealthLagThreshold: number;
  // JWT Authentication
  jwtAccessSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  // Cookie Configuration
  cookieSecret: string;
  cookieSecure: boolean;
  cookieSameSite: 'strict' | 'lax' | 'none';
  // Rate Limiting
  throttleLoginLimit: number;
  throttleLoginTtl: number;
  throttleRegisterLimit: number;
  throttleRegisterTtl: number;
  throttlePasswordResetLimit: number;
  throttlePasswordResetTtl: number;
  throttleResendVerificationLimit: number;
  throttleResendVerificationTtl: number;
  throttleRefreshLimit: number;
  throttleRefreshTtl: number;
  // Content creation rate limiting
  throttlePostCreateLimit: number;
  throttlePostCreateTtl: number;
  throttleCommentCreateLimit: number;
  throttleCommentCreateTtl: number;
  throttleReactionCreateLimit: number;
  throttleReactionCreateTtl: number;
  throttleMessageSendLimit: number;
  throttleMessageSendTtl: number;
  throttleReportCreateLimit: number;
  throttleReportCreateTtl: number;
  throttleProfileUpdateLimit: number;
  throttleProfileUpdateTtl: number;
  // Media upload
  mediaAvatarMaxSizeBytes: number;
  mediaResumeMaxSizeBytes: number;
  mediaAllowedContentTypes: string[];
  // Billing
  billingProvider: string;
  billingWebhookSecret: string;
  billingDefaultFreePlanSlug: string;
}
