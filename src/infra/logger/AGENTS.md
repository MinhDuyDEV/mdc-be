<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# logger

## Purpose
Centralized HTTP request logging using Pino with automatic request ID generation, sensitive data redaction, and environment-aware formatting. Integrates with NestJS via nestjs-pino to provide structured logging across the application with request/response serialization and custom message formatting.

## Key Files
| File | Description |
|------|-------------|
| `logger.module.ts` | NestJS module configuring Pino logger with HTTP middleware, redaction rules, and transport options |
| `index.ts` | Public exports for the logger module |

## For AI Agents

### Working In This Directory
- The logger is configured as a NestJS module that must be imported into the root AppModule
- Pino HTTP middleware automatically logs all incoming requests with generated request IDs
- Sensitive paths are redacted: `authorization`, `cookie` headers and `password`, `token`, `refreshToken`, `accessToken` in request bodies
- Development mode uses `pino-pretty` for colorized console output; production uses standard JSON format
- Request/response serializers extract only essential fields: request ID, method, URL, and response status code
- Custom success/error messages format as: `{METHOD} {URL} {STATUS_CODE}`

### Testing Requirements
- Verify logger module imports correctly in NestJS application
- Test that request IDs are generated and included in logs
- Confirm sensitive data (passwords, tokens, auth headers) is redacted as `[REDACTED]`
- Validate that development mode produces pretty-printed output
- Ensure production mode outputs valid JSON logs
- Check that HTTP middleware captures all request/response metadata

### Common Patterns
- Import `LoggerModule` in root module: `imports: [LoggerModule]`
- Access logger in services via NestJS `Logger` from `@nestjs/common`
- Redaction paths are configured in `pinoHttp.redact.paths` array
- Custom serializers transform request/response objects before logging
- Transport configuration switches based on `NODE_ENV` environment variable

## Dependencies

### Internal
- `../config` — AppConfig type for environment variables

### External
- `@nestjs/common` — NestJS core decorators and utilities
- `nestjs-pino` — NestJS integration for Pino logger
- `pino` — Structured logging library
- `pino-pretty` — Pretty-printer for Pino logs (dev only)
- `node:crypto` — Built-in Node.js crypto for UUID generation
- `node:http` — Built-in Node.js HTTP types
