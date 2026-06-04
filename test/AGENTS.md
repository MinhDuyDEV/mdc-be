<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# test/ — End-to-End Testing

## PURPOSE

End-to-end testing for mdc-be validates the full application stack: HTTP routing, middleware, validation, error handling, and dependency integration (Postgres, Redis, MinIO, Elasticsearch, MailHog). Tests run against a real NestJS application instance with mocked external services in local development, and with Testcontainers in CI.

## KEY FILES

| File | Purpose |
|------|---------|
| `admin.e2e-spec.ts` | Admin module endpoints: user management, role assignment, system settings |
| `analytics.e2e-spec.ts` | Analytics module: entity metrics, engagement tracking, data retrieval |
| `app.e2e-spec.ts` | Application bootstrap: HTTP routes, health checks, security headers, validation, payload limits |
| `applications.e2e-spec.ts` | Job applications: create, list, update status, withdraw, track metrics |
| `auth.e2e-spec.ts` | Authentication: login, signup, JWT validation, password reset, token refresh |
| `billing.e2e-spec.ts` | Billing module: subscriptions, invoices, payment processing, usage tracking |
| `companies.e2e-spec.ts` | Company profiles: create, update, search, followers, analytics |
| `connections.e2e-spec.ts` | User connections: send/accept/reject requests, list connections, block users |
| `feed.e2e-spec.ts` | Feed generation: personalized content, filtering, pagination, real-time updates |
| `health.e2e-spec.ts` | Health checks: liveness probe, readiness probe, dependency status |
| `jobs.e2e-spec.ts` | Job postings: create, list, search, apply, close, analytics |
| `media.e2e-spec.ts` | Media uploads: S3 integration, presigned URLs, file validation |
| `messaging.e2e-spec.ts` | Direct messaging: send, list, mark read, delete, search conversations |
| `moderation.e2e-spec.ts` | Content moderation: flag content, review, take action, analytics |
| `notifications.e2e-spec.ts` | Notifications: create, list, mark read, preferences, real-time delivery |
| `phase-4-vertical-slice.e2e-spec.ts` | Vertical slice integration test covering multiple modules end-to-end |
| `posts.e2e-spec.ts` | Posts: create, list, like, comment, share, delete, search |
| `profiles.e2e-spec.ts` | User profiles: view, update, skills, experience, recommendations |
| `realtime.e2e-spec.ts` | WebSocket connections: real-time notifications, presence, messaging |
| `recruiting.e2e-spec.ts` | Recruiting module: candidate search, pipeline management, offers |
| `search.e2e-spec.ts` | Search: full-text search across posts, jobs, users, companies |
| `jest-e2e.json` | Jest configuration for e2e tests; runs files matching `.e2e-spec.ts` |
| `helpers/` | Shared test utilities, fixtures, and Testcontainers setup (see `helpers/AGENTS.md`) |

## TESTING APPROACH

### Test Structure

E2E tests use **NestJS Testing Module** to bootstrap a real application instance:

```typescript
const moduleFixture = await Test.createTestingModule({
  imports: [AppModule],
  controllers: [ContractController], // test-only controllers
})
  .overrideProvider(PrismaService)
  .useValue({
    /* mocked */
  })
  .overrideProvider(RedisHealthService)
  .useValue({
    /* mocked */
  })
  .compile();

app = moduleFixture.createNestApplication({ bodyParser: false });
configureApp(app); // apply middleware, pipes, filters
await app.init();
```

### Environment Setup

E2E suites set environment variables before bootstrapping:

- `NODE_ENV=test`
- `PORT=3000`
- `CORS_ORIGINS=http://localhost:3000,http://localhost:5173`
- `BODY_JSON_LIMIT=1kb`, `BODY_URLENCODED_LIMIT=1kb`
- `DATABASE_URL=postgresql://mdc:mdc_dev_password@localhost:5432/mdc?schema=public` (local dev)
- `REDIS_URL=redis://localhost:6379` (local dev)
- `HEALTH_DATABASE_TIMEOUT_MS=1000`, `HEALTH_REDIS_TIMEOUT_MS=1000`

**CI with Testcontainers:**

When `MDC_E2E_TESTCONTAINERS=true`, `helpers/e2e-global-setup.ts` starts containers before tests:

- **Postgres 16** on port 5432 (user: postgres, password: postgres, db: mdc_test)
- **Redis 7** on port 6379
- **MinIO** on ports 9000 (API) and 9001 (console)
- **Elasticsearch 8.17** on port 9200
- **MailHog** on ports 1025 (SMTP) and 8025 (web UI)

Environment variables are automatically set to point to container endpoints. After tests complete, `helpers/e2e-global-teardown.ts` stops all containers.

### Mocking Strategy

- **PrismaService**: Mocked with `$connect`, `$disconnect`, `$queryRaw` (returns `[{ '?column?': 1 }]`)
- **RedisHealthService**: Mocked with `ping()` returning `undefined`
- Real middleware, pipes, filters, and error handlers execute normally
- External services (S3, Elasticsearch, SMTP) use Testcontainers in CI

### HTTP Testing

Tests use **supertest** to make HTTP requests against the running app:

```typescript
request(app.getHttpServer())
  .get('/api/v1/endpoint')
  .expect(200)
  .expect((response) => {
    /* assertions */
  });
```

## TESTING REQUIREMENTS

### Contract Tests

Every e2e test validates a specific contract:

1. **Root smoke test** — `GET /` returns `200` with `"Hello World!"`
2. **Liveness probe** — `GET /health/live` returns `{ status: 'ok', checks: { api: { status: 'up' } } }`
3. **Readiness probe** — `GET /health/ready` returns `{ status: 'ok', checks: { postgres: { status: 'up' }, redis: { status: 'up' } } }`
4. **Security headers** — All responses include `x-content-type-options: nosniff` (Helmet)
5. **API versioning** — Application routes are behind `/api/v1`; direct routes return `404`
6. **Response envelope** — Successful responses wrap data: `{ data: { /* payload */ } }`
7. **Validation errors** — Invalid payloads return `400` with error envelope: `{ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [...] } }`
8. **Payload limits** — Requests exceeding `BODY_JSON_LIMIT` return `413`

### Test Isolation

- `beforeEach`: Create fresh app instance, set environment
- `afterEach`: Close app, restore environment, clear mocks
- No shared state between tests

## COMMON PATTERNS

### Adding a New E2E Test

```typescript
it('describes the contract being tested', async () => {
  const response = await request(app!.getHttpServer())
    .post('/api/v1/endpoint')
    .send({
      /* payload */
    })
    .expect(200); // or expected status code

  expect(response.body).toEqual({
    data: {
      /* expected response */
    },
  });
});
```

### Testing Validation

```typescript
it('rejects invalid input', async () => {
  const response = await request(app!.getHttpServer())
    .post('/api/v1/endpoint')
    .send({ invalidField: 'value' })
    .expect(400);

  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(response.body.error.details).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ property: 'invalidField' }),
    ]),
  );
});
```

### Testing Health Checks

Health checks are mocked in local dev; verify the response structure and status codes:

```typescript
it('returns readiness with mocked dependencies', async () => {
  const response = await request(app!.getHttpServer())
    .get('/health/ready')
    .expect(200);

  expect(response.body.checks).toHaveProperty('postgres');
  expect(response.body.checks).toHaveProperty('redis');
});
```

### Testing Payload Limits

Set `BODY_JSON_LIMIT` in `beforeEach` and send oversized payloads:

```typescript
it('rejects oversized payloads', () => {
  return request(app!.getHttpServer())
    .post('/api/v1/endpoint')
    .send({ data: 'x'.repeat(2_000) })
    .expect(413);
});
```

### Testing with Testcontainers (CI)

When `MDC_E2E_TESTCONTAINERS=true`, tests can use real database and cache:

```typescript
it('creates a user in real database', async () => {
  const response = await request(app!.getHttpServer())
    .post('/api/v1/users')
    .send({
      email: 'test@example.com',
      password: 'SecurePassword123!',
    })
    .expect(201);

  expect(response.body.data.id).toBeDefined();
  expect(response.body.data.email).toBe('test@example.com');
});
```

## DEPENDENCIES

### Runtime

- **@nestjs/common** — Decorators, controllers, pipes
- **@nestjs/testing** — `Test.createTestingModule`, `INestApplication`
- **supertest** — HTTP request builder and assertions
- **class-validator** — DTO validation (via `@IsString()`, etc.)
- **jest** — Test runner and assertions

### Configuration

- **jest-e2e.json** — Configures Jest to run `.e2e-spec.ts` files with `ts-jest` transformer
- **tsconfig.json** — Must have `experimentalDecorators` and `emitDecoratorMetadata` enabled

### External Services

- **Postgres** — Mocked via `PrismaService` (local dev); real via Testcontainers (CI)
- **Redis** — Mocked via `RedisHealthService` (local dev); real via Testcontainers (CI)
- **MinIO** — Real via Testcontainers (CI)
- **Elasticsearch** — Real via Testcontainers (CI)
- **MailHog** — Real via Testcontainers (CI)

### Testcontainers

- **testcontainers** 11.x — Container orchestration for integration tests
- **@testcontainers/postgresql** — PostgreSQL container
- **@testcontainers/redis** — Redis container
- **@testcontainers/minio** — MinIO container
- **@testcontainers/elasticsearch** — Elasticsearch container

## RUNNING TESTS

```bash
# Run all e2e tests (local dev with mocks)
npm run test:e2e

# Run a specific test file
npm run test:e2e -- admin.e2e-spec.ts

# Run with coverage
npm run test:e2e -- --coverage

# Watch mode
npm run test:e2e -- --watch

# Run with Testcontainers (CI)
MDC_E2E_TESTCONTAINERS=true npm run test:e2e
```

## AGENT INSTRUCTIONS

When writing or updating e2e tests:

1. **Understand the contract** — Read the controller and service to understand what the endpoint should return
2. **Set up environment** — Ensure all required env vars are set in `beforeEach`
3. **Mock external services** — Override `PrismaService` and `RedisHealthService` with predictable mocks
4. **Test the full stack** — Include middleware, pipes, filters, and error handlers in assertions
5. **Verify response envelopes** — All successful responses must wrap data in `{ data: { ... } }`; errors in `{ error: { code, message, details } }`
6. **Test edge cases** — Validation failures, oversized payloads, missing fields, type mismatches
7. **Isolate tests** — Use `beforeEach`/`afterEach` to prevent cross-test pollution
8. **Use descriptive names** — Test names should read like contracts: "GET /api/v1/endpoint returns 200 with data envelope"
9. **Assert response structure** — Don't just check status codes; verify the response body matches the contract
10. **Keep tests focused** — One contract per test; avoid testing multiple concerns in a single `it` block
11. **Test Testcontainers setup** — When adding new containers or services, verify they start correctly and environment variables are set
12. **Document CI differences** — If a test behaves differently in CI (with Testcontainers), add a comment explaining why

## TESTCONTAINERS SETUP

### Global Setup (`helpers/e2e-global-setup.ts`)

Runs before all e2e tests when `MDC_E2E_TESTCONTAINERS=true`:

1. Starts Postgres, Redis, MinIO, Elasticsearch, MailHog containers
2. Waits for each container to be ready (health checks, log messages)
3. Sets environment variables to point to container endpoints
4. Writes container IDs to temp file for teardown

### Global Teardown (`helpers/e2e-global-teardown.ts`)

Runs after all e2e tests:

1. Reads container IDs from temp file
2. Stops all containers
3. Cleans up temp file

### Container Definitions

Each container is defined with:
- Image name and version
- Environment variables (credentials, config)
- Exposed ports (container → host mapping)
- Wait strategy (health check, log message, HTTP endpoint)
- Startup timeout (how long to wait before failing)

### Adding a New Container

1. Add container definition to `definitions` array in `e2e-global-setup.ts`
2. Add environment variable setup to `applyContainerEnv()`
3. Update this AGENTS.md with new container details
4. Test locally: `MDC_E2E_TESTCONTAINERS=true npm run test:e2e`

## TEST HELPERS

See `helpers/AGENTS.md` for:
- E2E global setup and teardown
- Testcontainers state management
- WebSocket client helper
- Mock implementations
