<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common

## Purpose

Shared cross-cutting concerns providing reusable decorators, guards, interceptors, pipes, error handlers, and response utilities. All domain modules import CommonModule to access authentication, authorization, validation, and idempotency infrastructure.

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
| `decorators/` | Custom decorators: `@Roles()`, `@Permissions()`, `@VerifiedEmail()`, `@CompanyRole()` |
| `errors/` | Custom exception classes and error handling utilities |
| `guards/` | Authorization guards: RolesGuard, PolicyGuard, EmailVerifiedGuard, CompanyRoleGuard |
| `idempotency/` | Idempotency key interceptor for POST/PUT/PATCH operations |
| `pagination/` | Pagination DTOs and utilities: PaginationDto, PaginatedResponse |
| `policies/` | Policy-based authorization framework: PolicyHandler interface |
| `response/` | Standard response wrappers and transformers |
| `validation/` | Custom validation pipes and decorators |

## For AI Agents

### Working In This Directory

- **Authentication Pattern**: Use `@CurrentUser()` decorator to extract authenticated user from request, `AuthenticatedUser` interface provides id, email, roles, permissions, never access `req.user` directly
- **Authorization Pattern**: Use `@Roles()` for role requirements (ADMIN, MODERATOR, USER), `@Permissions()` for admin permissions, `@VerifiedEmail()` for email verification, `@CompanyRole()` for company-specific roles, guards applied in order: Authentication → Roles → Permissions → Policies
- **Idempotency Pattern**: `IdempotencyKeyInterceptor` automatically handles `Idempotency-Key` header, applies to POST/PUT/PATCH endpoints, returns cached response for duplicate requests within TTL window
- **Pagination Pattern**: Use `PaginationDto` for query parameters (page, limit, sortBy, sortOrder), return `PaginatedResponse<T>` with items, total, page, limit, totalPages, default page size: 20, max: 100
- **Validation Pattern**: Use `validationPipeFactory()` to create custom validation pipes, DTOs use class-validator decorators, validation errors return 400 with structured error messages
- **Error Handling Pattern**: Throw NestJS built-in exceptions (NotFoundException, BadRequestException, etc.), custom exceptions extend HttpException, global exception filter formats all errors consistently

### Testing Requirements

- Test decorators extract correct metadata
- Test guards enforce authorization rules correctly
- Test guards throw UnauthorizedException when rules fail
- Test idempotency interceptor caches responses
- Test idempotency interceptor returns cached response for duplicate keys
- Test pagination DTO validates page/limit bounds
- Test validation pipe rejects invalid DTOs
- Mock dependencies (PrismaService, ConfigService) for guard tests

### Common Patterns

```typescript
// Authentication + Authorization
@Get('admin/users')
@Roles('ADMIN')
@Permissions('MANAGE_USERS')
async listUsers(@CurrentUser() user: AuthenticatedUser) {
  // user.id, user.email, user.roles, user.permissions available
}

// Email verification requirement
@Post('profiles')
@VerifiedEmail()
async createProfile(@CurrentUser() user: AuthenticatedUser) {
  // Only verified users can create profiles
}

// Company role requirement
@Patch('companies/:id/settings')
@CompanyRole('ADMIN', 'OWNER')
async updateSettings(
  @Param('id') companyId: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  // Only company admins/owners can update settings
}

// Pagination
@Get('posts')
async listPosts(@Query() pagination: PaginationDto) {
  const { items, total } = await this.service.findAll(pagination);
  return new PaginatedResponse(items, total, pagination.page, pagination.limit);
}

// Idempotency (automatic via interceptor)
@Post('payments')
async createPayment(
  @Headers('idempotency-key') key: string,
  @Body() dto: CreatePaymentDto,
) {
  // Interceptor handles duplicate detection automatically
}
```

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
