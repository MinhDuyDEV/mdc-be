<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common

## Purpose

Shared utilities and cross-cutting concerns for the NestJS backend. Provides authentication decorators, error handling, pagination, response formatting, validation, and authorization policies. All modules in `src/` depend on CommonModule for consistent API behavior, error handling, and request/response envelopes.

## Key Files

| File | Description |
|------|-------------|
| `common.module.ts` | NestJS module declaration; currently empty but serves as namespace for barrel exports |
| `index.ts` | Barrel export; re-exports all public APIs from subdirectories |
| `common.spec.ts` | Unit tests for CommonModule primitives: response envelopes, interceptors, filters, validation |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `auth/` | Authentication decorators and interfaces: `@CurrentUser()`, `@Public()`, `AuthenticatedUser` interface |
| `errors/` | Global exception filter and error response types: `ApiExceptionFilter`, `ApiErrorResponse` |
| `pagination/` | Cursor-based pagination DTO and metadata: `CursorPaginationQueryDto`, pagination constants |
| `policies/` | Authorization policy types and interfaces: `PolicyContext`, `PolicyHandler` |
| `response/` | API response interceptor and types: `ApiResponseInterceptor`, `ApiSuccessResponse`, response envelope factory |
| `validation/` | Validation pipe factory and options: `createValidationPipe()`, `defaultValidationPipeOptions` |

## For AI Agents

### Working In This Directory

- **Module structure**: CommonModule is a namespace; all exports are re-exported via `index.ts`. Do not add providers to CommonModule unless they need to be injected globally.
- **Barrel exports**: Each subdirectory has an `index.ts` that controls its public API. Always export new utilities through the barrel.
- **Global interceptors/filters**: `ApiResponseInterceptor` and `ApiExceptionFilter` are registered globally in `bootstrap.ts`; do not duplicate them.
- **Type safety**: All interfaces are exported from subdirectories; use them consistently across the codebase.
- **Decorators**: `@CurrentUser()` and `@Public()` are NestJS param/metadata decorators; use them on controller methods.
- **Validation**: Use `createValidationPipe()` to instantiate validation pipes with sensible defaults; customize via options parameter.
- **Pagination**: `CursorPaginationQueryDto` is the standard pagination query DTO; extend it for specific endpoints if needed.
- **Error handling**: Throw NestJS exceptions (`BadRequestException`, `UnauthorizedException`, etc.); `ApiExceptionFilter` normalizes them to the public error envelope.
- **Response formatting**: Do not manually wrap responses; `ApiResponseInterceptor` wraps all non-root responses automatically.

### Testing Requirements

- **Unit tests**: Colocate `*.spec.ts` files alongside source files in each subdirectory.
- **Test coverage**: `common.spec.ts` covers primitives (response envelopes, interceptors, filters, validation); add tests for new utilities.
- **Run tests**: `npm test` runs all unit tests; `npm test -- src/common` runs only CommonModule tests.
- **Coverage target**: Aim for >80% on new code.

### Common Patterns

- **Param decorators**: Use `createParamDecorator()` to extract request data; see `CurrentUser` for example.
- **Metadata decorators**: Use `SetMetadata()` to attach metadata; see `Public` for example.
- **Exception filters**: Implement `ExceptionFilter` interface; catch exceptions and format responses.
- **Interceptors**: Implement `NestInterceptor` interface; use RxJS `map()` to transform responses.
- **DTOs**: Use `class-validator` decorators (`@IsString()`, `@IsInt()`, etc.) for validation; use `class-transformer` for transformation.
- **Type guards**: Use type guards (e.g., `isApiSuccessResponse()`) to narrow types safely.
- **Error normalization**: `ApiExceptionFilter` normalizes various error formats (HttpException, statusCode, message) to a consistent envelope.

## Dependencies

### Internal

- **auth/**: Exports `CurrentUser`, `Public`, `AuthenticatedUser` for use in controllers and guards.
- **errors/**: Exports `ApiExceptionFilter`, `ApiErrorResponse` for global error handling.
- **pagination/**: Exports `CursorPaginationQueryDto`, pagination constants for query DTOs.
- **policies/**: Exports `PolicyContext`, `PolicyHandler` for authorization logic.
- **response/**: Exports `ApiResponseInterceptor`, `ApiSuccessResponse`, `createApiResponse()` for response formatting.
- **validation/**: Exports `createValidationPipe()`, `defaultValidationPipeOptions` for input validation.

### External

- **@nestjs/common**: `Injectable`, `Module`, `Catch`, `ExceptionFilter`, `NestInterceptor`, `createParamDecorator`, `SetMetadata`, `ValidationPipe`, `BadRequestException`, `HttpException`, `HttpStatus`.
- **@nestjs/core**: `ArgumentsHost`, `ExecutionContext`, `CallHandler`.
- **class-validator**: `IsString`, `IsInt`, `IsOptional`, `Min`, `Max`, `ValidationError`.
- **class-transformer**: `Transform`.
- **rxjs**: `map`, `Observable`.
