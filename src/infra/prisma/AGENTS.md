<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/infra/prisma

## Purpose

Prisma ORM service wrapper that manages PostgreSQL database connection lifecycle. Extends PrismaClient and implements NestJS lifecycle hooks to connect on module init and disconnect on module destroy. Provides a singleton service injected globally across the application.

## Key Files

| File | Description |
|------|-------------|
| `prisma.service.ts` | NestJS service that extends PrismaClient; implements OnModuleInit (connect) and OnModuleDestroy (disconnect) |
| `index.ts` | Barrel export; re-exports PrismaService |

## For AI Agents

### Working In This Directory

- **Service extension**: PrismaService extends PrismaClient, so all Prisma methods (query, create, update, delete, etc.) are available directly on the service.
- **Lifecycle management**: onModuleInit() connects to the database when the module is initialized; onModuleDestroy() disconnects when the module is destroyed.
- **Singleton pattern**: PrismaService is provided as a singleton by NestJS; all services receive the same instance.
- **Dependency injection**: Inject PrismaService in any service constructor; NestJS automatically provides the singleton instance.
- **Type safety**: Prisma generates types from schema.prisma; use these types in queries and mutations.
- **Connection pooling**: Prisma handles connection pooling internally; no manual pool management needed.

### Testing Requirements

- **Unit tests**: `prisma.service.spec.ts` tests lifecycle hooks and basic connectivity.
- **Test cases**: Mock PrismaClient; verify onModuleInit() calls $connect(), onModuleDestroy() calls $disconnect(); test error handling if connection fails.
- **Integration tests**: Use test database (separate from development/production); run migrations before tests, clean up after.
- **Mocking in other tests**: Mock PrismaService in tests of services that depend on it; use jest.mock() or provide a test double.
- **Run tests**: `npm test -- src/infra/prisma` runs prisma tests only; `npm run test:e2e` runs integration tests with real database.

### Common Patterns

- **Query execution**: Use Prisma query methods directly on the service (e.g., `this.prisma.user.findUnique()`).
- **Raw queries**: Use `this.prisma.$queryRaw` for raw SQL when needed (e.g., health checks: `SELECT 1`).
- **Transactions**: Use `this.prisma.$transaction()` for multi-step operations that must succeed or fail together.
- **Error handling**: Prisma throws PrismaClientKnownRequestError for known errors (unique constraint, not found, etc.); catch and convert to NestJS exceptions.
- **Async/await**: All Prisma operations are async; use await in service methods.

## Dependencies

### Internal

- None (prisma is a leaf module with no internal dependencies).

### External

- **@nestjs/common**: Injectable, OnModuleInit, OnModuleDestroy decorators.
- **@prisma/client**: PrismaClient base class.
- **prisma**: CLI tool for migrations and schema management (dev dependency).

### Environment Variables (from config/)

- `DATABASE_URL`: PostgreSQL connection string (required).

## Database Schema

- **Location**: `prisma/schema.prisma` (at project root).
- **Migrations**: Run `npx prisma migrate dev` to create and apply migrations.
- **Type generation**: Prisma generates types in `node_modules/@prisma/client`; import from `@prisma/client`.
- **Schema updates**: Edit schema.prisma, create migration, apply migration, regenerate types.

## Connection Lifecycle

1. **App startup**: NestJS initializes InfraModule, which provides PrismaService.
2. **onModuleInit**: PrismaService.onModuleInit() is called; it calls $connect() to establish database connection.
3. **App running**: All services use the connected PrismaService instance.
4. **App shutdown**: NestJS calls onModuleDestroy() on all services; PrismaService.onModuleDestroy() calls $disconnect() to close the connection.
5. **Connection pool**: Prisma maintains a connection pool; individual queries reuse connections from the pool.
