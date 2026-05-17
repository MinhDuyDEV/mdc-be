<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/infra/config

## Purpose

Environment configuration validation and schema definition. Parses and validates all required environment variables at application startup, ensuring the app fails fast if configuration is invalid. Provides a typed AppConfig interface that is injected globally via NestJS ConfigService.

## Key Files

| File | Description |
|------|-------------|
| `app-config.ts` | TypeScript interface defining all configuration properties (nodeEnv, port, corsOrigins, database/redis URLs, health check timeouts) |
| `validate-env.ts` | Validation logic; parses raw environment variables and returns typed AppConfig; throws on invalid values |
| `index.ts` | Barrel export; re-exports AppConfig and validateEnv |

## For AI Agents

### Working In This Directory

- **Configuration schema**: AppConfig interface is the single source of truth for all app configuration; add new config properties here first.
- **Validation**: validateEnv() is called by ConfigModule during app bootstrap; it receives process.env and returns a typed config object or throws.
- **Parsing functions**: Each environment variable type has a dedicated parser (parsePort, parsePositiveInteger, parseBodyLimit, parseCorsOrigins, requireString).
- **Error messages**: Validation errors are descriptive and include the expected format (e.g., "PORT must be an integer between 1 and 65535").
- **Type safety**: AppConfig uses literal types (e.g., nodeEnv: 'development' | 'test' | 'production') to enable strict type checking downstream.
- **No defaults**: All environment variables are required; there are no fallback defaults. This ensures explicit configuration.

### Testing Requirements

- **Unit tests**: `validate-env.spec.ts` tests both valid and invalid environment variables.
- **Test cases**: Cover happy path (valid config), missing variables, invalid formats (bad port, invalid NODE_ENV, malformed body limits), and edge cases (empty CORS_ORIGINS, port 0 or 65536).
- **Mocking**: No external dependencies to mock; tests call validateEnv() directly with test data.
- **Run tests**: `npm test -- src/infra/config` runs config tests only.

### Common Patterns

- **Validation order**: Required variables are checked first, then parsed/validated. This prevents null reference errors.
- **Parser composition**: Each parser is a pure function that takes raw env and key, validates, and returns typed value or throws.
- **Error handling**: Throw descriptive Error objects; NestJS ConfigModule catches them and logs them during bootstrap.
- **Immutability**: AppConfig is a plain object; it is not modified after creation.
- **Strict mode**: ConfigService is instantiated with `<AppConfig, true>` (strict mode) to enforce type safety when accessing config values.

## Dependencies

### Internal

- None (config is a leaf module with no internal dependencies).

### External

- **@nestjs/config**: ConfigModule, ConfigService (used by parent InfraModule).
- **TypeScript**: Type definitions for AppConfig interface.

### Environment Variables (Required)

- `NODE_ENV`: 'development' | 'test' | 'production'
- `PORT`: Integer 1–65535
- `CORS_ORIGINS`: Comma-separated list of allowed origins (at least one)
- `BODY_JSON_LIMIT`: Size limit for JSON body (e.g., '1mb', '512kb', '1024b')
- `BODY_URLENCODED_LIMIT`: Size limit for URL-encoded body (e.g., '1mb', '512kb', '1024b')
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection URL
- `HEALTH_DATABASE_TIMEOUT_MS`: Timeout for database health check (positive integer, milliseconds)
- `HEALTH_REDIS_TIMEOUT_MS`: Timeout for Redis health check (positive integer, milliseconds)

## Adding New Configuration

1. Add the new property to AppConfig interface in `app-config.ts`.
2. Add a parser function in `validate-env.ts` if the type is new (e.g., parseBoolean, parseUrl).
3. Call the parser in validateEnv() and add the result to the returned object.
4. Add test cases in `validate-env.spec.ts` for valid and invalid values.
5. Document the new environment variable in this file and in the parent AGENTS.md.
