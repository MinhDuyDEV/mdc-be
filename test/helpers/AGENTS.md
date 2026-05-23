<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# test/helpers/

## Purpose

Shared test utilities, fixtures, and helper functions for unit and E2E tests. Provides reusable test setup, mocks, and assertion helpers to reduce test boilerplate.

## Key Files

| File | Description |
|------|-------------|
| `test-helpers.ts` | Common test utilities and helper functions |
| `fixtures.ts` | Test data fixtures for users, posts, jobs, etc. |
| `mocks.ts` | Mock implementations of services and external dependencies |

## For AI Agents

### Working In This Directory

- **Reusable fixtures** — Create factory functions for test data generation
- **Mock consistency** — Keep mocks consistent with actual service interfaces
- **Type safety** — Ensure test helpers are fully typed
- **No business logic** — Helpers should be simple utilities, not business logic
- **Documentation** — Document helper functions with JSDoc comments

### Testing Requirements

```bash
# Test helpers should be tested themselves
npm test -- test-helpers.spec.ts
```

### Common Patterns

**Test Fixture Factory:**
```typescript
export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: randomUUID(),
    email: 'test@example.com',
    passwordHash: 'hashed',
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

**Mock Service:**
```typescript
export function createMockPrismaService(): DeepMockProxy<PrismaService> {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as any;
}
```

**Test Setup Helper:**
```typescript
export async function setupTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(createMockPrismaService())
    .compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
```

## Dependencies

### Internal

- `test/` — Parent test directory
- `src/` — Application code being tested

### External

- `@nestjs/testing` — Testing utilities
- `jest` — Test framework
- `@faker-js/faker` — Test data generation (if used)

<!-- MANUAL: -->
