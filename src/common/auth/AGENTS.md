<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common/auth

## Purpose

Authentication decorators and interfaces for NestJS controllers. Provides utilities to extract the current authenticated user from requests and mark routes as public (bypassing authentication). Used by all protected endpoints to access user context and by public endpoints to opt out of auth guards.

## Key Files

| File | Description |
|------|-------------|
| `current-user.interface.ts` | `AuthenticatedUser` interface: id, email, roles |
| `current-user.decorator.ts` | `@CurrentUser()` param decorator: extracts user from request |
| `public.decorator.ts` | `@Public()` metadata decorator: marks routes as public |
| `index.ts` | Barrel export: re-exports all public APIs |

## For AI Agents

### Working In This Directory

- **Param decorators**: `@CurrentUser()` is a NestJS param decorator created with `createParamDecorator()`. Use it on controller method parameters to inject the authenticated user.
- **Metadata decorators**: `@Public()` uses `SetMetadata()` to attach a marker to route handlers. Guards check for this marker to skip authentication.
- **User interface**: `AuthenticatedUser` is a minimal interface with `id` (required), `email` and `roles` (optional). Extend it if additional user properties are needed.
- **Request attachment**: The decorator assumes `request.user` is populated by an auth guard (e.g., JWT guard). If the guard is missing or misconfigured, the decorator returns `undefined`.
- **Type safety**: Always type the `@CurrentUser()` parameter as `AuthenticatedUser | undefined` to handle unauthenticated requests on public routes.

### Testing Requirements

- **Unit tests**: Test `@CurrentUser()` decorator with mock ExecutionContext and request objects.
- **Test coverage**: Verify decorator returns user when present, returns undefined when absent, and handles missing request.user gracefully.
- **Run tests**: `npm test -- src/common/auth`
- **Coverage target**: Aim for >80% on new code.

### Common Patterns

- **Extracting user**: Use `@CurrentUser()` on controller methods to get the authenticated user.
  ```typescript
  @Get(':id')
  getUser(@CurrentUser() user: AuthenticatedUser | undefined) {
    // user is the authenticated user or undefined
  }
  ```
- **Public routes**: Use `@Public()` on controller methods to bypass auth guards.
  ```typescript
  @Post('login')
  @Public()
  login(@Body() credentials: LoginDto) {
    // This route does not require authentication
  }
  ```
- **Role-based access**: Check `user.roles` in controllers or guards to enforce role-based authorization.
  ```typescript
  if (!user?.roles?.includes('admin')) {
    throw new ForbiddenException('Admin role required');
  }
  ```

## Dependencies

### Internal

- **errors/**: May throw `UnauthorizedException` or `ForbiddenException` when user is missing or lacks permissions.
- **policies/**: `AuthenticatedUser` is used in `PolicyContext` for authorization checks.

### External

- **@nestjs/common**: `createParamDecorator`, `ExecutionContext`, `SetMetadata`.
