<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common/errors

## Purpose

Global exception filter and error response types for NestJS. Normalizes all exceptions (NestJS HttpException, custom errors, unhandled errors) into a consistent API error envelope. Registered globally in `bootstrap.ts` to catch all exceptions and format them for clients.

## Key Files

| File | Description |
|------|-------------|
| `error-response.types.ts` | `ApiErrorBody` and `ApiErrorResponse` interfaces: error envelope structure |
| `api-exception.filter.ts` | `ApiExceptionFilter`: global exception filter that normalizes errors |
| `index.ts` | Barrel export: re-exports all public APIs |

## For AI Agents

### Working In This Directory

- **Exception filter**: `ApiExceptionFilter` is a NestJS `@Catch()` filter that intercepts all exceptions. It normalizes various error formats (HttpException, statusCode, message) into a consistent envelope.
- **Error normalization**: The filter extracts `code`, `message`, `details`, and `requestId` from exceptions and wraps them in `ApiErrorResponse`.
- **Request ID tracking**: The filter reads `x-request-id` header from the request and includes it in the error response for tracing.
- **HTTP status mapping**: The filter maps exception status codes to HTTP response status codes. If no status is found, it defaults to 500 (INTERNAL_SERVER_ERROR).
- **Error codes**: The filter generates error codes from HttpException error types (e.g., "Bad Request" → "BAD_REQUEST") or uses custom codes if provided.
- **Global registration**: The filter is registered globally in `bootstrap.ts`; do not instantiate it in individual modules.

### Testing Requirements

- **Unit tests**: Test `ApiExceptionFilter` with various exception types: HttpException, custom errors, unhandled errors.
- **Test coverage**: Verify filter normalizes errors correctly, extracts request IDs, maps status codes, and formats responses.
- **Run tests**: `npm test -- src/common/errors`
- **Coverage target**: Aim for >80% on new code.

### Common Patterns

- **Throwing exceptions**: Use NestJS exceptions (`BadRequestException`, `UnauthorizedException`, `ForbiddenException`, etc.) in controllers and services. The filter will normalize them.
  ```typescript
  throw new BadRequestException({
    code: 'INVALID_INPUT',
    message: 'Email is required',
    details: { field: 'email' }
  });
  ```
- **Error response structure**: All errors follow this structure:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable message",
      "details": { /* optional */ },
      "requestId": "uuid" /* optional */
    }
  }
  ```
- **Custom error codes**: Pass a `code` field in the exception response to use a custom error code instead of the HTTP status name.
- **Error details**: Include a `details` field in the exception response to provide additional context (e.g., validation errors, field names).

## Dependencies

### Internal

- **response/**: Error responses are separate from success responses; both use the same envelope structure.
- **validation/**: Validation errors are caught by this filter and formatted with validation details.

### External

- **@nestjs/common**: `Catch`, `ExceptionFilter`, `HttpException`, `HttpStatus`, `ArgumentsHost`.
