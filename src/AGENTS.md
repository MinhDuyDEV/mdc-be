<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src

## Purpose

Root application layer for the NestJS 11 backend API. Orchestrates the main application module, HTTP routing, and service logic. Integrates infrastructure (config, database, cache) and common utilities (validation, error handling, response formatting) to provide a cohesive API surface.

## Key Files

| File | Description |
|------|-------------|
| `main.ts` | Bootstrap entry point; creates NestFactory app, configures middleware, starts server on PORT (default 3000) |
| `bootstrap.ts` | App configuration: helmet, body parsers, validation pipes, exception filters, interceptors, CORS, global prefix `/api/v1` |
| `app.module.ts` | Root NestJS module; imports CommonModule and InfraModule; declares AppController and AppService |
| `app.controller.ts` | HTTP controller; defines root GET `/` endpoint via AppService |
| `app.service.ts` | Business logic service; provides `getHello()` method |
| `app.controller.spec.ts` | Unit tests for AppController |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `common/` | Shared utilities: auth, error handling, pagination, policies, response formatting, validation (see `common/AGENTS.md`) |
| `infra/` | Infrastructure layer: config, health checks, Prisma ORM, Redis cache (see `infra/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Entry point**: Always start from `main.ts` to understand bootstrap flow.
- **Module structure**: AppModule imports CommonModule and InfraModule; do not add providers directly to AppModule unless they are app-level singletons.
- **Configuration**: All config is injected via ConfigService from InfraModule; never hardcode values.
- **Global middleware**: Configured in `bootstrap.ts`; add new middleware there, not in AppModule.
- **API prefix**: All routes except `/`, `/health/live`, `/health/ready` are prefixed with `/api/v1`.
- **Error handling**: Use ApiExceptionFilter (global); throw NestJS exceptions, not raw errors.
- **Response format**: All responses pass through ApiResponseInterceptor; do not manually format responses.

### Testing Requirements

- **Unit tests**: Colocate `*.spec.ts` files in `src/` alongside source files.
- **E2E tests**: Place in `test/` directory with `jest-e2e.json` config.
- **Run tests**: `npm test` (unit), `npm run test:e2e` (integration).
- **Coverage**: Jest configured in `package.json`; aim for >80% on new code.

### Common Patterns

- **Dependency injection**: Use NestJS `@Injectable()` and constructor injection; avoid service locator pattern.
- **Decorators**: `@Controller()`, `@Get()`, `@Post()`, `@Injectable()`, `@Module()` are standard.
- **Async/await**: All async operations must be properly awaited; ESLint warns on floating promises.
- **Type safety**: Use strict TypeScript; `noImplicitAny: false` means missing types become `any` — be explicit.
- **Module exports**: Use barrel exports (`index.ts`) to control public API of each module.

## Dependencies

### Internal

- **CommonModule**: Provides validation pipes, exception filters, interceptors, auth utilities, pagination, policies, response formatting.
- **InfraModule**: Provides ConfigService, PrismaService, Redis client, health checks.

### External

- **@nestjs/core**: NestFactory, INestApplication, decorators.
- **@nestjs/config**: ConfigModule, ConfigService for environment validation.
- **@nestjs/common**: Controller, Get, Injectable, Module, RequestMethod.
- **helmet**: Security headers middleware.
- **express**: json, urlencoded body parsers.
- **jest**: Unit and E2E testing framework.
- **eslint + prettier**: Linting and code formatting.
