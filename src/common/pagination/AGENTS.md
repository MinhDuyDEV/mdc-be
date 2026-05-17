<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common/pagination

## Purpose

Cursor-based pagination DTO and metadata types for NestJS query parameters. Provides a standard pagination query DTO with cursor and limit parameters, and metadata types for pagination responses. Used by list endpoints to accept pagination input and return pagination metadata.

## Key Files

| File | Description |
|------|-------------|
| `cursor-pagination.dto.ts` | `CursorPaginationQueryDto`: pagination query DTO with cursor and limit; `CursorPaginationMeta`: pagination metadata interface; constants for default and max limits |
| `index.ts` | Barrel export: re-exports all public APIs |

## For AI Agents

### Working In This Directory

- **Query DTO**: `CursorPaginationQueryDto` is a class-validator DTO for pagination query parameters. Use it as a base class or composition in list endpoint query DTOs.
- **Cursor parameter**: `cursor` is an optional string that points to the next page. It's opaque to the client; the server generates it based on the last item in the previous page.
- **Limit parameter**: `limit` is an optional integer (default 20, max 100). It controls the number of items per page. The `@Transform()` decorator converts string input to a number.
- **Validation**: The DTO uses `class-validator` decorators to validate input: `@IsInt()`, `@Min(1)`, `@Max(100)`. Invalid input throws a validation error.
- **Metadata**: `CursorPaginationMeta` includes `nextCursor` (optional), `hasNextPage` (boolean), and `limit` (number). Include this in the response `meta` field.
- **Constants**: `DEFAULT_PAGE_LIMIT` (20) and `MAX_PAGE_LIMIT` (100) are exported for use in other modules.

### Testing Requirements

- **Unit tests**: Test `CursorPaginationQueryDto` with valid and invalid inputs (missing limit, limit > max, non-integer limit).
- **Test coverage**: Verify DTO transforms string limit to number, validates min/max, and handles optional cursor.
- **Run tests**: `npm test -- src/common/pagination`
- **Coverage target**: Aim for >80% on new code.

### Common Patterns

- **Extending the DTO**: Create a list query DTO that extends or composes `CursorPaginationQueryDto`:
  ```typescript
  export class ListUsersQueryDto extends CursorPaginationQueryDto {
    @IsOptional()
    @IsString()
    search?: string;
  }
  ```
- **Using in controllers**: Accept the DTO as a query parameter and pass it to the service:
  ```typescript
  @Get()
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }
  ```
- **Returning pagination metadata**: Include `CursorPaginationMeta` in the response:
  ```typescript
  return createApiResponse(items, {
    nextCursor: nextCursor,
    hasNextPage: items.length === query.limit,
    limit: query.limit
  });
  ```
- **Generating cursors**: Cursors are typically base64-encoded identifiers (e.g., user ID or timestamp). Decode them in the service to fetch the next page.

## Dependencies

### Internal

- **response/**: Pagination metadata is included in the response `meta` field via `createApiResponse()`.
- **validation/**: `CursorPaginationQueryDto` uses `class-validator` decorators; validation errors are caught by the global validation pipe.

### External

- **class-validator**: `IsInt`, `IsOptional`, `IsString`, `Min`, `Max`, `ValidationError`.
- **class-transformer**: `Transform`.
