import type { AppConfig, ProcessRole } from "./app-config";

const VALID_NODE_ENVS = new Set(["development", "test", "production"]);
const BODY_LIMIT_PATTERN = /^\d+(b|kb|mb)$/i;
const VALID_PROCESS_ROLES = new Set<ProcessRole>([
	"api",
	"worker",
	"realtime",
	"all",
]);

export type RawEnv = Record<string, string | undefined>;

function requireString(env: RawEnv, key: string): string {
	const value = env[key];
	if (value === undefined || value.trim() === "") {
		throw new Error(`Missing required environment variable: ${key}`);
	}

	return value;
}

function parseOptionalString(env: RawEnv, key: string): string {
	return env[key]?.trim() ?? "";
}

function parsePort(raw: string): number {
	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("PORT must be an integer between 1 and 65535");
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
	if (raw === undefined || raw === "") return defaultVal;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${key} must be a positive integer`);
	}

	return value;
}

function parseBoolean(env: RawEnv, key: string): boolean {
	const value = requireString(env, key).toLowerCase();
	if (value === "true") return true;
	if (value === "false") return false;
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
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0);

	if (origins.length === 0) {
		throw new Error("CORS_ORIGINS must include at least one origin");
	}

	return origins;
}

function parseProcessRole(value: string | undefined): ProcessRole {
	const role = value ?? "all";
	if (!VALID_PROCESS_ROLES.has(role as ProcessRole)) {
		throw new Error(
			`APP_PROCESS_ROLE must be one of: api, worker, realtime, all (got: ${role})`,
		);
	}

	return role as ProcessRole;
}

export function validateEnv(env: RawEnv): AppConfig {
	const nodeEnv = requireString(env, "NODE_ENV");
	if (!VALID_NODE_ENVS.has(nodeEnv)) {
		throw new Error("NODE_ENV must be one of development, test, production");
	}

	return {
		nodeEnv: nodeEnv as AppConfig["nodeEnv"],
		port: parsePort(requireString(env, "PORT")),
		corsOrigins: parseCorsOrigins(requireString(env, "CORS_ORIGINS")),
		bodyJsonLimit: parseBodyLimit(env, "BODY_JSON_LIMIT"),
		bodyUrlencodedLimit: parseBodyLimit(env, "BODY_URLENCODED_LIMIT"),
		databaseUrl: requireString(env, "DATABASE_URL"),
		redisUrl: requireString(env, "REDIS_URL"),
		healthDatabaseTimeoutMs: parsePositiveInteger(
			env,
			"HEALTH_DATABASE_TIMEOUT_MS",
		),
		healthRedisTimeoutMs: parsePositiveInteger(env, "HEALTH_REDIS_TIMEOUT_MS"),
		// S3 / MinIO
		s3Endpoint: requireString(env, "S3_ENDPOINT"),
		s3Region: requireString(env, "S3_REGION"),
		s3AccessKeyId: requireString(env, "S3_ACCESS_KEY_ID"),
		s3SecretAccessKey: requireString(env, "S3_SECRET_ACCESS_KEY"),
		s3Bucket: requireString(env, "S3_BUCKET"),
		s3ForcePathStyle: parseBoolean(env, "S3_FORCE_PATH_STYLE"),
		healthS3TimeoutMs: parsePositiveInteger(env, "HEALTH_S3_TIMEOUT_MS"),
		// Elasticsearch
		elasticsearchNode: requireString(env, "ELASTICSEARCH_NODE"),
		healthElasticsearchTimeoutMs: parsePositiveInteger(
			env,
			"HEALTH_ELASTICSEARCH_TIMEOUT_MS",
		),
		// SMTP (host, user, pass are optional in dev for streamTransport fallback)
		smtpHost: parseOptionalString(env, "SMTP_HOST"),
		smtpPort: parsePort(requireString(env, "SMTP_PORT")),
		smtpSecure: parseBoolean(env, "SMTP_SECURE"),
		smtpUser: parseOptionalString(env, "SMTP_USER"),
		smtpPass: parseOptionalString(env, "SMTP_PASS"),
		emailFrom: requireString(env, "EMAIL_FROM"),
		healthMailerTimeoutMs: parsePositiveInteger(
			env,
			"HEALTH_MAILER_TIMEOUT_MS",
		),
		// OpenTelemetry
		otelServiceName: requireString(env, "OTEL_SERVICE_NAME"),
		otelExporterOtlpEndpoint: requireString(env, "OTEL_EXPORTER_OTLP_ENDPOINT"),
		// Process role
		appProcessRole: parseProcessRole(env.APP_PROCESS_ROLE),
		// Outbox (all with sensible defaults)
		outboxPollIntervalMs: parseOptionalPositiveInteger(
			env,
			"OUTBOX_POLL_INTERVAL_MS",
			5000,
		),
		outboxBatchSize: parseOptionalPositiveInteger(env, "OUTBOX_BATCH_SIZE", 20),
		outboxMaxRetries: parseOptionalPositiveInteger(
			env,
			"OUTBOX_MAX_RETRIES",
			5,
		),
		outboxBaseBackoffMs: parseOptionalPositiveInteger(
			env,
			"OUTBOX_BASE_BACKOFF_MS",
			1000,
		),
		outboxMaxBackoffMs: parseOptionalPositiveInteger(
			env,
			"OUTBOX_MAX_BACKOFF_MS",
			60000,
		),
		outboxLeaseTimeoutMs: parseOptionalPositiveInteger(
			env,
			"OUTBOX_LEASE_TIMEOUT_MS",
			60000,
		),
		outboxHealthLagThreshold: parseOptionalPositiveInteger(
			env,
			"OUTBOX_HEALTH_LAG_THRESHOLD",
			100,
		),
	};
}
