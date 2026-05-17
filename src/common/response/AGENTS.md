<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common/response

## Purpose

API response interceptor and types for NestJS. Normalizes all successful responses into a consistent envelope with `data` and optional `meta` fields. Registered globally in `bootstrap.ts` to wrap all non-root endpoint responses automatically.

## Key Files

| File | Description |
|------|-------------|
| `api-response.types.ts` | `ApiSuccessResponse`: response envelope interface; `ApiResponseMeta`: metadata interface; `createApiResponse()` factory; `isApiSuccessResponse()` type guard |
| `api-response.interceptor.ts` | `ApiResponseInterceptor`: global interceptor that wraps responses in the envelope |
| `index.ts` | Barrel export: re-exports all public APIs |

## For AI Agents

### Working In This Directory

- **Response interceptor**: `ApiResponseInterceptor` is a NestJS `@Injectable()` interceptor that wraps all responses (except root paths) in the `ApiSuccessResponse` envelope.
- **Bypass paths**: The interceptor skips wrapping for root paths (`/`, `/health/live`, `/health/ready`). Add paths to `BYPASS_PATHS` if needed.
- **Response envelope**: All successful responses follow this structure:
  ```json
  {
    "data": { /* response body */ },
    "meta": { /* optional metadata */ }
  }
  ```
- **Metadata**: The `meta` field is optional and can contain any metadata (pagination, timestamps, etc.). Use `createApiResponse(data, meta)` to include metadata.
- **Type safety**: Use `isApiSuccessResponse()` type guard to check if a value is already wrapped before wrapping again.
- **Global registration**: The interceptor is registered globally in `bootstrap.ts`; do not instantiate it in individual modules.

### Testing Requirements

- **Unit tests**: Test `ApiResponseInterceptor` with various response types: objects, arrays, primitives, already-wrapped responses.
- **Test coverage**: Verify interceptor wraps responses correctly, skips bypass paths, handles already-wrapped responses, and preserves metadata.
- **Run tests**: `npm test -- src/common/response`
- **Coverage target**: Aim for >80% on new code.

### Common Patterns

- **Returning data**: Controllers return raw data; the interceptor wraps it automatically:
  ```typescript
  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.findById(id); // Returns User object
    // Interceptor wraps it: { data: User, meta: undefined }
  }
  ```
- **Returning with metadata**: Use `createApiResponse()` to include metadata:
  ```typescript
  @Get()
  listUsers(@Query() query: ListUsersQueryDto) {
    const users = this.usersService.list(query);
    return createApiResponse(users, {
      nextCursor: query.cursor,
      hasNextPage: users.length === query.limit,
      limit: query.limit
    });
  }
  ```
- **Pagination metadata**: Include pagination info in the `meta` field:
  ```typescript
  return createApiResponse(items, {
    pagination: {
      nextCursor: nextCursor,
      hasNextPage: hasNextPage,
      limit: limit
    }
  });
  ```
- **Custom metadata**: Add any custom metadata to the `meta` field:
  ```typescript
  return createApiResponse(data, {
    timestamp: new Date().toISOString(),
    version: '1.0',
    custom: { /* any data */ }
  });
  ```

## Dependencies

### Internal

- **errors/**: Error responses are separate from success responses; both use different envelope structures.
- **pagination/**: Pagination metadata is typically included in the response `meta` field.

### External

- **@nestjs/common**: `Injectable`, `NestInterceptor`, `ExecutionContext`, `CallHandler`.
- **rxjs**: `map`, `Observable`.
