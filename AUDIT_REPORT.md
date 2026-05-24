# MinhDuyDEV/mdc-be — Senior Code Audit

**Reviewer role:** Senior Backend Architect / Principal Engineer
**Repo:** `MinhDuyDEV/mdc-be` (NestJS 11 + Prisma 6 + Postgres 16 + Redis 7 + S3 + Elasticsearch)
**Source size:** 19,468 LOC production + 13,359 LOC tests across ~350 `.ts` files
**Audit date:** 2026-05-23 (UTC)
**Mode:** Read-only. No code changes, no commits, no PRs.

---

# Executive Summary

## Where the project is
This is a serious, well-structured modular monolith. The team has already done the hard work that most NestJS projects skip:
- Strict environment validation (`validate-env.ts`), config-driven runtime roles (`api|worker|realtime|all`).
- Transactional outbox with `FOR UPDATE SKIP LOCKED`, leasing, exponential backoff, dead-letter table, and a manual replay path.
- Idempotency table with `(scope, key)` unique constraint.
- Real-time gateway with Redis-backed Socket.IO adapter for horizontal fan-out.
- Pino structured logs with PII/secret redaction paths.
- OpenTelemetry SDK + Prisma instrumentation, OTLP exporters.
- 75 test suites / 739 unit tests passing; e2e suites exist for almost every domain.
- Health endpoints with per-dependency timeouts and outbox-lag SLO.

Compared to a "fresh NestJS starter", this is roughly **Phase-1-shippable as an early-access internal product** with significant production gaps. It is **NOT yet ready** to take untrusted public traffic at scale, primarily because of broken refresh-token rotation, an unsafe media authorization model, and missing operational guardrails described below.

## Top 5 risks (production / security / correctness)

1. **Refresh-token rotation is functionally broken and insecure.**
   `TokenService.validateAndRotateRefreshToken` uses `findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })` — it doesn't actually look up the token presented by the client. It picks the user's most recent token regardless of which device sent it. The `familyId` parameter is taken in by the API but never persisted (no `familyId` column on `RefreshToken`). The refresh endpoint also requires the (expired) access token alongside the cookie to decode `sub`. Net effect: multi-device sessions interfere with each other, "reuse detection" is essentially fake, and stolen refresh tokens are not detectably reused. **[P0]**

2. **Media authorization model cannot serve public assets.**
   `MediaService.getDownloadUrl` returns 404 unless `asset.ownerId === user.id`. The same restriction is applied at delete and confirm. There is no concept of "this avatar is referenced by a public Profile / Post / Company, anyone can read it." Avatars, post images, company logos cannot actually be displayed to anyone but the uploader. This is a product-breaking authorization model. **[P0]**

3. **Webhook signature guard silently degrades when raw body is missing.**
   `WebhookSignatureGuard` falls back to `JSON.stringify(request.body)` when `req.rawBody` is absent. The fallback string will not equal the bytes the provider HMAC-signed, so signatures will mismatch for any request whose body parser ran without `verify` capturing the raw buffer — and the only `verify` hook is on the JSON parser. Combined with the global `ApiResponseInterceptor` wrapping `{ received: true }` into `{ data: { received: true } }`, the webhook contract is fragile. **[P1]**

4. **Idempotency leaks across rolled-back transactions.**
   `IdempotencyService.claim` uses `this.prisma` (outer client), not the caller's `tx`. When invoked from inside `prisma.$transaction` (e.g. `WebhookService.processWebhook`, `CompaniesService.createCompany`), the idempotency row is *committed independently* even if the surrounding transaction rolls back. A failed creation then permanently blocks the retry of that key for 24h. **[P1]**

5. **CI runs `eslint --fix` and ignores 157 warnings.**
   `package.json` defines `"lint": "eslint ... --fix"`, which auto-modifies files on every CI run. The ESLint config explicitly downgrades the most important rules (`no-explicit-any: off`, `no-floating-promises: warn`, `no-unsafe-argument: warn`). A fresh local `eslint --max-warnings 0` reports **157 warnings, 0 errors**, including 2 unsafe `any` casts in `auth.service.ts` itself. CI is currently green only because warnings are ignored. **[P1]**

## Top 5 high-ROI improvements

1. **Fix `PrismaTransaction` typing once → kill 18 `tx as any` casts.**
   `src/infra/prisma/prisma.service.ts` defines `PrismaTransaction = Omit<PrismaService, '$connect'|...>` which doesn't match the actual transactional client. Change it to `import { Prisma } from '@prisma/client'; export type PrismaTransaction = Prisma.TransactionClient;` and `OutboxService.emit(tx, ...)` callers can stop using `tx as any` (currently `auth.service.ts:76, 153`, `companies.service.ts:209, 268, 306, 344, 375, 430, 521, 627, 684, 810, 928, 998`, `media.service.ts:123, 203`, `profiles.service.ts:99`). Small change, large type-safety win across the entire codebase.

2. **Tighten `tsconfig.json` and ESLint into a real safety net.**
   Current `tsconfig.json` only enables `strictNullChecks` and `noImplicitAny`. Enabling `"strict": true` unlocks `noImplicitThis`, `alwaysStrict`, `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization`, `useUnknownInCatchVariables`. Combined with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, this would catch dozens of latent bugs immediately. Promote `no-floating-promises` and `no-unsafe-argument` to errors, change CI to `eslint --max-warnings 0` (no `--fix`).

3. **Fix the refresh-token + cookie + secret-source plumbing in one go.**
   Add `familyId` to the `RefreshToken` model and persist it; look up by `(userId, familyId)` (or token-id encoded in a JWT envelope); stop requiring the Bearer access token on `/auth/refresh`; read `COOKIE_SECURE` / `COOKIE_SAME_SITE` / refresh expiry through `ConfigService` (currently `auth.controller.ts:65, 146` read `process.env` directly, contradicting the project's "always inject ConfigService" rule). Remove dead `JWT_REFRESH_SECRET` config or actually use it to sign refresh tokens.

4. **Split media authorization model from ownership-only.**
   Introduce a `visibility` or `accessPolicy` field on `MediaAsset` (or derive it from the linking model — Profile picture / Post image / Company logo). `getDownloadUrl` should check (a) owner OR (b) any READY asset referenced by a publicly-visible parent. Optionally serve "public" media through long-lived CDN-style URLs rather than per-request presigns.

5. **Make `npm test` and `npm run build` work without `.env` set in the shell.**
   Today `npm test` crashes mid-run with `Missing required environment variable: PORT` because some test file pulls in `validateEnv` directly. Either add a `jest.setup.ts` that sets a known-good test env, or extract the schema-only parts of `validateEnv` so unit tests don't need every infra env var. This is the #1 paper cut for new contributors.

---

# Severity Rubric

| Level | Definition |
|-------|-----------|
| **P0** | Production-breaking, security-critical, data loss, auth bypass |
| **P1** | High-risk bug, consistency issue, major maintainability blocker |
| **P2** | Important reliability/scalability/test gap |
| **P3** | Nice-to-have, cleanup, style, DX |

---

# Findings

## Architecture & Domain Boundaries

### [P2] `app.module.ts` ScheduleModule gating disables cron jobs in `realtime` mode but the realtime gateway has an `@Interval`
**Evidence:** `src/app.module.ts:45-56`, `src/realtime/realtime.gateway.ts:97` (`@Interval(30_000)`)
**Issue:** `ScheduleModule.forRootAsync` returns `cronJobs: isWorker, intervals: isWorker` where `isWorker = role === 'worker' || role === 'all'`. In `APP_PROCESS_ROLE=realtime`, neither cron jobs nor intervals run — yet `RealtimeGateway.@Interval(30_000)` (presumably presence/heartbeat cleanup) lives in that role.
**Impact:** Realtime-only deployments silently lose periodic cleanup/heartbeat logic. Outbox is also disabled, but realtime workloads may need the outbox poller; verify intended role split.
**Recommendation:** Refine gating per concern: e.g. `cronJobs: ['worker','all'].includes(role)`, `intervals: ['worker','realtime','all'].includes(role)`. Or move the realtime `@Interval` into a worker-side job and emit through the outbox.
**Suggested Fix Scope:** Small

### [P2] Domain modules cross-import each other (e.g. `MessagingPolicyService` injected into the realtime `ChatGateway`)
**Evidence:** `src/realtime/chat.gateway.ts` imports `MessagingPolicyService` from `src/messaging/`
**Issue:** Realtime depends on Messaging policy, which is fine, but there's no explicit boundary layer between them. As more cross-domain dependencies accumulate, the "modular monolith" can degenerate into spaghetti. There's no `core` / `shared-policies` package.
**Impact:** As you add more cross-domain logic (recruiting ↔ jobs, messaging ↔ connections, posts ↔ feed) you'll need to either accept this coupling or refactor into a shared kernel later. Today it's tolerable; document the rule.
**Recommendation:** Either (a) only allow same-domain or `common/`/`infra/` imports and explicitly list approved cross-domain ports; or (b) extract policy services that are reused across domains into `src/common/policies/`. Codify with an ESLint `no-restricted-imports` rule that whitelists allowed cross-module paths.
**Suggested Fix Scope:** Medium

### [P3] `OutboxProcessorModule` is imported by AppModule unconditionally — relies on schedule gating to disable polling
**Evidence:** `src/app.module.ts:69`, `src/outbox/outbox.processor.ts:74` (`@Cron`)
**Issue:** OutboxProcessor is wired into the API role too; only the schedule gating prevents the `@Cron` from firing. Any future code path that calls `processOutbox()` directly will fire regardless of role.
**Impact:** Low today, but defense-in-depth missing.
**Recommendation:** Skip importing `OutboxProcessorModule` entirely in `api`/`realtime` modes via `app.module.ts` `imports: [...isWorker ? [OutboxProcessorModule] : []]` (dynamic module).
**Suggested Fix Scope:** Small

---

## API Contract & Error Handling

### [P1] Billing webhook response is wrapped by `ApiResponseInterceptor`, breaking the documented contract
**Evidence:** `src/billing/webhooks/webhook.controller.ts:23-36`, `src/common/response/api-response.interceptor.ts`
**Issue:** The controller returns `{ received: true, ...result }`, expecting providers to receive that shape. The global `ApiResponseInterceptor` wraps every non-root response into `{ data: ... }`, so providers actually receive `{ data: { received: true, ... } }`. Some providers do healthcheck/probe on response body shape.
**Impact:** Stripe-like providers may flag the endpoint as failing even though processing succeeded; replay/dead-letter loops on the provider side.
**Recommendation:** Either skip the interceptor for `/billing/webhooks/*` (add bypass path in `ApiResponseInterceptor.BYPASS_PATHS`), or have the controller bypass the interceptor via `@SkipResponseEnvelope()` decorator pattern. Same applies to any future raw-response endpoints (e.g. RSS, CSV exports).
**Suggested Fix Scope:** Small

### [P2] Request-ID header from middleware ≠ Request-ID in Pino logs
**Evidence:** `src/bootstrap.ts:57-62`, `src/infra/logger/logger.module.ts:40` (`genReqId: () => randomUUID()`)
**Issue:** `bootstrap.ts` sets an `x-request-id` response header using either the inbound header or a fresh UUID, but never stores it on the request. PinoHttp's `genReqId` ignores headers and generates an independent UUID. Therefore the request ID in logs is unrelated to the one returned to the client — and the one propagated in `ApiExceptionFilter`'s `error.requestId`.
**Impact:** Operators can't trace a failed request from a client-reported request ID to the logs.
**Recommendation:** Use `genReqId: (req) => req.headers['x-request-id'] ?? randomUUID()` in Pino, and write that ID back as `res.setHeader('x-request-id', req.id)`. Inject the same value into `ApiExceptionFilter`/interceptor so the response envelope's `requestId` matches the log line.
**Suggested Fix Scope:** Small

### [P2] `ApiExceptionFilter` swallows non-`HttpException` errors as `INTERNAL_SERVER_ERROR` without logging
**Evidence:** `src/common/errors/api-exception.filter.ts:23-39`
**Issue:** Filter normalizes any non-HttpException into a 500 with message "Internal server error", but does not call the Pino logger or `console.error`. Unexpected exceptions disappear silently from operator view (Pino's HTTP autolog only sees the success/failure status, not the stacktrace).
**Impact:** Reduced observability on uncaught errors. Errors in interceptors / pipes after the response logger has fired never get surfaced.
**Recommendation:** Inject `PinoLogger` (or use `Logger`) into `ApiExceptionFilter` and log non-HttpException with stacktrace. Add an OpenTelemetry span event for normalized errors.
**Suggested Fix Scope:** Small

### [P3] `body.type || body.event_type` cast as string without validation
**Evidence:** `src/billing/webhooks/webhook.controller.ts:28-32`
**Issue:** `eventType` is taken from untrusted webhook body and cast `as string` without any check. If both fields are missing, `eventType = undefined` flows into `WebhookService.processWebhook` and ends up in the DB as `null`/`'undefined'`.
**Impact:** Bad data in `payment_provider_events.event_type`; downstream switch statements no-op without warning.
**Recommendation:** Validate via DTO/Zod schema per provider. Reject with 400 if `eventType` is missing.
**Suggested Fix Scope:** Small

---

## Auth, Authorization & Security

### [P0] Refresh token lookup is by `userId` only — multi-device sessions break, reuse detection is fake
**Evidence:** `src/auth/token.service.ts:49-91` (`validateAndRotateRefreshToken`), `src/auth/token.service.ts:93-111` (`revokeRefreshToken`), `prisma/schema.prisma:338-351` (no `familyId` column)
**Issue:**
- `findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })` finds the user's latest token, not the token the client presented. Two devices ⇒ device A's refresh will rotate device B's token.
- The `familyId` parameter is accepted by the API but the model has no `familyId` column to persist it. Reuse detection therefore can't distinguish between "same family, stolen token" and "different device".
- On reuse / invalid token, `updateMany({ where: { userId }, ... revokedAt: new Date() })` revokes *every* token of *every* device on *every* failure.
- `revokeRefreshToken` also operates on the latest token by `userId`.

**Impact:** Catastrophic for real-world clients:
- A user with two browsers / mobile + web cannot keep both sessions alive; the latest device wins.
- A leaked refresh token used legitimately or maliciously will revoke ALL of the user's sessions; users will be kicked out of every device.
- Stolen-token reuse detection is not actually implemented — there is no per-family chain of rotations.

**Recommendation:**
1. Add `familyId String` and `parentTokenId String?` columns to `refresh_tokens`; create an index on `(userId, familyId)`.
2. Identify tokens by ID inside the cookie payload (e.g. emit a signed JWT refresh token whose `jti` is the row's PK, signed with `JWT_REFRESH_SECRET`).
3. Lookup with `findUnique({ where: { id: tokenId } })` and verify `userId` matches the request.
4. On reuse detected, revoke only the family (`updateMany({ where: { familyId } })`), not all sessions.
5. Drop the requirement to also send a Bearer access token on `/auth/refresh` (see next finding).

**Suggested Fix Scope:** Medium

### [P1] `/auth/refresh` requires Bearer access token alongside the refresh cookie; `userId` is taken from a non-verified `decode()` call
**Evidence:** `src/auth/auth.controller.ts:85-126`
**Issue:** The controller refuses the refresh request if no `Authorization: Bearer ...` is present (`throw new UnauthorizedException('Access token required for refresh')`) and then uses `this.jwtService.decode(accessToken)` — which does **not** verify the signature — to extract `sub`. Two consequences:
1. Once the access token expires + is purged from memory by the client (the normal SPA flow), refresh becomes impossible because the access token is no longer available.
2. Anyone with a *forged or expired* access token whose `sub` matches a real user, plus that user's refresh cookie, can refresh. (In practice the attacker would already need the cookie to be in the same browser; but architecturally `decode()` should never be the basis for trust.)

**Impact:** Refresh is half-broken (legitimate clients can't refresh after access-token expiry) and the trust model is muddled.
**Recommendation:** Derive `userId` from the refresh token itself (after looking it up). Don't require the access token. If you want stateless refresh, sign the refresh token as a JWT with `JWT_REFRESH_SECRET` (verifyAsync, not decode) and store only `jti` server-side.
**Suggested Fix Scope:** Small (once refresh-rotation rewrite happens)

### [P1] `JWT_REFRESH_SECRET` and `JWT_REFRESH_EXPIRES_IN` are required env vars but never used in code
**Evidence:** `src/infra/config/validate-env.ts` requires them; `src/auth/token.service.ts:26-47` uses `randomUUID()` + bcrypt for refresh tokens.
**Issue:** Refresh tokens are random UUIDs hashed by bcrypt — not JWTs. The two refresh-secret env vars are dead code.
**Impact:** Misleading configuration for operators. Suggests JWT refresh tokens are signed when they aren't.
**Recommendation:** Either (a) make refresh tokens JWTs signed with `JWT_REFRESH_SECRET` and remove the bcrypt hashing layer (UUIDs don't need bcrypt — a SHA-256 is sufficient and 100× faster), or (b) remove the unused config and update `.env.example`.
**Suggested Fix Scope:** Small

### [P1] `AuthGuard` returns the same error for required-and-missing vs required-and-invalid vs optional-and-invalid
**Evidence:** `src/auth/auth.guard.ts:50-63`
**Issue:**
```ts
try { ... } catch {
  if (isOptionalAuth) {
    throw new UnauthorizedException('Invalid or expired access token');
  }
  throw new UnauthorizedException('Invalid or expired access token');
}
```
Both branches throw `UnauthorizedException`. For an `@OptionalAuth()` route, an invalid token should arguably either be silently treated as "anonymous" or rejected — but currently every invalid token forces 401, which is identical behaviour to required auth.
**Impact:** Optional auth is effectively required auth as soon as the client sends a malformed Bearer.
**Recommendation:** Decide policy. The pragmatic one: on `@OptionalAuth()`, log the decode failure and proceed as anonymous (`request.user = undefined`) rather than throwing. This matches industry expectation for "public, but enriched if logged in" endpoints.
**Suggested Fix Scope:** Small

### [P1] Global throttler is 10 req/60s — far too low for a real app
**Evidence:** `src/app.module.ts:37-43`
**Issue:** The default global throttler is `{ limit: 10, ttl: 60000 }` — i.e. 10 requests per minute per IP/user. Individual controllers override this with `@Throttle({...})`, but for everything else (profile views, feed reads, etc.) the cap is 10/min.
**Impact:** Real users hit the throttler within seconds of normal navigation; integrations break immediately.
**Recommendation:** Set global default to e.g. `{ limit: 300, ttl: 60000 }` and keep per-route `@Throttle` on sensitive endpoints (login, register, password reset). Document the throttler design in `docs/architecture.md`.
**Suggested Fix Scope:** Small

### [P1] WebSocket gateway accepts token from query string ⇒ logged in URLs/proxies
**Evidence:** `src/realtime/chat.gateway.ts:67`, `src/realtime/ws-jwt.guard.ts:48-52`
**Issue:** Both handlers accept the JWT from `handshake.query.token` as a fallback to `handshake.auth.token`. Query strings end up in proxy/CDN/load-balancer access logs, server access logs, and browser history.
**Impact:** Access tokens leaked to log infrastructure.
**Recommendation:** Drop the query-string fallback entirely; require `auth.token` (Socket.IO native) or `Authorization` header. Document the requirement.
**Suggested Fix Scope:** Small

### [P2] `AuthGuard` is global (`APP_GUARD`) but `@Public()` decorator is only checked via `getAllAndOverride` on `getHandler` + `getClass`
**Evidence:** `src/auth/auth.guard.ts:13-21`
**Issue:** `@Public()` works for controller and method, but not for guards higher up (e.g. on a base controller superclass) and not for routes attached via `@Module({ controllers: [...] })` without decoration. For non-NestJS routes (Express `app.use(...)`) the guard does not run at all — currently fine because there are none, but worth documenting.
**Impact:** Low risk in practice but reviewers must keep mental model in sync.
**Recommendation:** Document the contract; consider adding a check that throws at startup if any controller class is missing both `@Public()` and any auth-related decorator (forces explicit choice).
**Suggested Fix Scope:** Medium

### [P2] `auth.controller.ts:65, 146` read `process.env.COOKIE_SECURE` directly
**Evidence:** `src/auth/auth.controller.ts:65`, `:146`
**Issue:** Project rule: "all config is injected via ConfigService from InfraModule; never hardcode values" (`src/AGENTS.md`). Two callsites bypass ConfigService and read `process.env` directly. `validate-env.ts` *does* parse `COOKIE_SECURE`, so the controller could use it via DI.
**Impact:** Cookie-flag behaviour relies on ambient env state at request time rather than validated config; can drift if env is mutated.
**Recommendation:** Inject `ConfigService<AppConfig, true>` and read `cookieSecure`, `cookieSameSite`, `jwtRefreshExpiresIn`. Same for `instrumentation.ts` which reads `OTEL_*` directly (acceptable because it runs before NestJS bootstrap, but pull values through a shared module/util).
**Suggested Fix Scope:** Small

### [P2] Webhook signature guard accepts `JSON.stringify(request.body)` as fallback for raw body
**Evidence:** `src/billing/webhooks/webhook-signature.guard.ts:39-47`
**Issue:** When `rawBody` capture failed (e.g. body parser changed, content-type not JSON, custom middleware ran first), the guard falls back to `JSON.stringify(request.body)`. The result is not byte-identical to what the provider signed (key ordering, whitespace, Unicode escaping).
**Impact:** Either (a) signature verifications start failing for legitimate webhooks once a parser is reconfigured, or worse (b) the silent fallback masks a misconfiguration in production.
**Recommendation:** Hard-fail if `rawBody` is absent: `throw new InternalServerErrorException('Raw body required for webhook signature verification')`. Remove the JSON.stringify fallback.
**Suggested Fix Scope:** Small

### [P2] No CSRF protection / cookie SameSite is hardcoded to `'lax'` ignoring config
**Evidence:** `src/auth/auth.controller.ts:70, 147`
**Issue:** Even though `COOKIE_SAME_SITE` is part of `validateEnv` (it can be `strict|lax|none`), the controller hardcodes `sameSite: 'lax'`. Combined with the fact that browser cookies are sent automatically on cross-site requests targeting the API (depending on CORS config), this is the standard CSRF surface for cookie-auth APIs.
**Impact:** State-changing endpoints that rely on cookies (`/auth/refresh`) are reachable from cross-origin forms with `lax` semantics on top-level navigations. The CORS allowlist limits damage but isn't a CSRF defense.
**Recommendation:** Read `cookieSameSite` from config. Add a CSRF token (double-submit cookie or header-based) for cookie-authenticated state-changing routes. Or move the refresh token entirely off cookies and into the response body / `Authorization` header (treat refresh as a one-shot exchange).
**Suggested Fix Scope:** Medium

### [P2] Helmet `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Embedder-Policy`, CSP are not configured
**Evidence:** `src/bootstrap.ts:22-32`
**Issue:** Custom helmet config only sets `hsts`, `frameguard`, `referrerPolicy`, `hidePoweredBy`. The defaults from Helmet 8 set sensible CORP/COOP but no CSP. CSP isn't strictly needed for a JSON API but defining it (e.g. `default-src 'none'; frame-ancestors 'none'`) prevents the rare HTML-embedding error.
**Impact:** Defense-in-depth weakened.
**Recommendation:** Add a minimal CSP suitable for a JSON API (`default-src 'none'; frame-ancestors 'none'`).
**Suggested Fix Scope:** Small

### [P3] Bcrypt over 36-char UUIDs is wasted CPU
**Evidence:** `src/auth/token.service.ts:31`, `passwordService.hash(token)` where `token = randomUUID()`
**Issue:** UUIDs have full entropy and don't benefit from bcrypt's salt-and-stretch design. Bcrypt cost ≈ 100ms/op on modern CPUs at default rounds; doing this on every refresh both inflates DB CPU usage and slows the refresh path.
**Impact:** Refresh latency unnecessarily high under load.
**Recommendation:** Hash refresh tokens with SHA-256 (constant time, sub-microsecond). Keep bcrypt only for passwords.
**Suggested Fix Scope:** Small

---

## Validation & Input Handling

### [P2] `createValidationPipe` defaults not centrally visible
**Evidence:** `src/common/validation/...` (verify); `src/bootstrap.ts:47`
**Issue:** Bootstrap uses `app.useGlobalPipes(createValidationPipe())` without any options. Operators reviewing the pipeline can't tell from `bootstrap.ts` whether `whitelist`, `transform`, `forbidNonWhitelisted` are on.
**Impact:** Documentation drift between `AGENTS.md` claims and real behaviour.
**Recommendation:** Either inline the options in bootstrap (`createValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })`) or document the defaults at the call site with a comment pointing to `validation/`.
**Suggested Fix Scope:** Small

### [P2] No `Idempotency-Key` request-header support on POST routes
**Evidence:** No matches for `idempotency-key` header in `src/**/*.ts` (grep)
**Issue:** The `IdempotencyKey` model is used internally for outbox-side dedup (e.g. company creation by `(user, name)`, webhook by `(provider, eventId)`). It's never exposed via a generic `Idempotency-Key` request header for clients, which is the standard pattern for POSTs against unreliable networks (e.g. Stripe-style).
**Impact:** Clients have no protection against double-submits caused by network retries (mobile, flaky connections).
**Recommendation:** Add an `IdempotencyInterceptor` that reads `Idempotency-Key`, hashes the request body, checks `idempotency_keys`, returns the stored response on hit. Document on each POST.
**Suggested Fix Scope:** Medium

---

## Database, Prisma & Transactions

### [P1] `PrismaTransaction` type is `Omit<PrismaService, ...>` — not the actual transaction client type
**Evidence:** `src/infra/prisma/prisma.service.ts:15-18`
**Issue:** Prisma's transaction callback is typed as `Prisma.TransactionClient` (from `@prisma/client`). The project defines its own `PrismaTransaction = Omit<PrismaService, '$connect'|'$disconnect'|'$on'|'$transaction'|'$use'|'$extends'>`. This is type-only and *appears* close, but the inferred type for `prisma.$transaction(async (tx) => ...)` is `Prisma.TransactionClient`, not `PrismaTransaction`. So callers writing `await this.outboxService.emit(tx, ...)` get a type-mismatch error — and "fix" it with `tx as any` (18 occurrences).
**Impact:** Every domain service that calls `OutboxService.emit` from inside `prisma.$transaction` has lost compile-time guarantees. Bugs in payload shape, wrong overload, missing await — all invisible. This is the single largest type-safety regression in the codebase.
**Recommendation:** Change `PrismaTransaction` to `Prisma.TransactionClient`:
```ts
import type { Prisma } from '@prisma/client';
export type PrismaTransaction = Prisma.TransactionClient;
```
Then rewrite all `tx as any` → `tx`. Add an ESLint rule `no-restricted-syntax: TSAsExpression[typeAnnotation.typeName.name='any']` to prevent regression.
**Suggested Fix Scope:** Small

### [P1] `OutboxService.emit` runtime check uses `(tx as any).outboxEvent?.create` — defensive code papering over the wrong type
**Evidence:** `src/outbox/outbox.service.ts:14-20`
**Issue:** Because the type signature is loose (see above), the implementation does a runtime check `if (!tx || typeof (tx as any).outboxEvent?.create !== 'function')`. This is symptomatic — the type system can't help.
**Impact:** Same as above; remove the cast once the type is correct.
**Recommendation:** Once `PrismaTransaction = Prisma.TransactionClient`, this runtime check becomes unnecessary; TypeScript guarantees the shape.
**Suggested Fix Scope:** Small

### [P1] `IdempotencyService.claim` uses `this.prisma` rather than the caller's `tx` — committed independently of the surrounding transaction
**Evidence:** `src/outbox/idempotency.service.ts:11-41`; called inside `prisma.$transaction` at `src/billing/webhooks/webhook.service.ts:50-54`, `src/companies/companies.service.ts:168-171`
**Issue:** `claim` is a no-tx method. The row is committed immediately on success and remains even if the surrounding transaction rolls back. Result: a failed `CompaniesService.createCompany` (e.g. unique-constraint race on member insert) permanently blocks retries of the same `(userId, name)` for 24h because the idempotency row was already committed.
**Impact:** False "already exists" errors after recoverable failures; users see an unexplained block on retry. With webhooks: if anything after `idempotencyService.claim` fails, the same provider event will be silently treated as a duplicate forever.
**Recommendation:** Make `claim` accept an optional `tx: Prisma.TransactionClient` and use it instead of `this.prisma`. Callers inside `$transaction` should pass `tx`. Also add an `unclaim`/garbage-collect path for known-failed flows. Alternatively, *only* claim after the business operation succeeds (move it to the end of the transaction), but that defeats the purpose of preventing double-spends.
**Suggested Fix Scope:** Small

### [P1] `CompaniesService.createCompany` calls `idempotencyService.claim` *before* `prisma.$transaction` ⇒ same leakage pattern
**Evidence:** `src/companies/companies.service.ts:168-171, 173-222`
**Issue:** `claim` runs outside the transaction; if the transaction body fails, the claim persists.
**Impact:** As above — user can't retry the same name.
**Recommendation:** Move `claim` inside the `$transaction`, pass `tx`.
**Suggested Fix Scope:** Small

### [P2] `createCompanyWithUniqueSlug` does `count` + `create` inside a transaction; retries up to 100 times but each iteration runs an extra round-trip
**Evidence:** `src/companies/companies.service.ts:95-132`
**Issue:** Logic is fine and the DB partial unique index `companies_slug_active_key` is the real authority, but the retry loop both pre-counts AND post-catches P2002. The pre-count is redundant noise; on a contended slug it adds N×roundtrip latency.
**Impact:** Wasted DB calls; in the high-contention case (popular slug) you'll do 100 counts before giving up.
**Recommendation:** Remove the pre-`count` and rely on `INSERT` + P2002 catch only. Cap retries lower (10 is plenty).
**Suggested Fix Scope:** Small

### [P2] `generateUniqueSlug` is a separate, racier version of the slug logic
**Evidence:** `src/companies/companies.service.ts:68-85` (used at `:344` in `updateCompany`)
**Issue:** Two slug-generation paths: `createCompanyWithUniqueSlug` (correct, P2002-aware) and `generateUniqueSlug` (count-only, TOCTOU-vulnerable). The second one is used on update.
**Impact:** Renaming a company can race and crash with `P2002` instead of retrying.
**Recommendation:** Use a single helper for both create and update paths. Delete `generateUniqueSlug`.
**Suggested Fix Scope:** Small

### [P2] `companies.service.ts:267-274` increments `followerCount` inside a transaction that also writes to `companyFollower` — risk of lost updates under contention
**Evidence:** `src/companies/companies.service.ts:259-274`
**Issue:** `tx.company.update({ data: { followerCount: { increment: 1 } } })` is safe as an SQL `UPDATE ... SET followerCount = followerCount + 1` (Prisma `increment` translates to that). However, the counter is then a denormalized cache; if any future code path forgets to use `{ increment: 1 }` and instead reads + writes, you'll get lost updates. Also, `_count.followers` is already available via Prisma's `_count` relation; the explicit counter is duplicative.
**Impact:** Maintenance burden; high write contention on hot companies (everyone unfollowing/refollowing).
**Recommendation:** Either (a) drop `followerCount` and use `prisma.company.findUnique({ include: { _count: { select: { followers: true } } } })` (current code already exposes this!), or (b) keep `followerCount` but document it as a denormalized cache with a periodic reconciliation job.
**Suggested Fix Scope:** Medium

### [P2] `prisma.$transaction` default timeout is 5s — long flows (e.g. company create with outbox emit, member insert, audit log) can hit it under load
**Evidence:** `src/companies/companies.service.ts:173`, etc.
**Issue:** None of the `$transaction` calls pass a `{ timeout, maxWait }` options object. Prisma's default `timeout` is 5000ms. For complex flows with several writes + outbox emit, this is tight.
**Impact:** Random `Transaction already closed` errors under load.
**Recommendation:** For any transaction with >3 writes, pass `{ timeout: 15_000, maxWait: 5_000 }`.
**Suggested Fix Scope:** Small

### [P2] No global Prisma logging / slow-query alerting
**Evidence:** `src/infra/prisma/prisma.service.ts` extends `PrismaClient` with no options
**Issue:** `new PrismaClient({ log: ['warn', 'error'] })` is not set; slow queries / errors are not surfaced to Pino. OpenTelemetry's Prisma instrumentation provides traces but not logs.
**Impact:** Cannot find N+1s in dev without enabling logs manually.
**Recommendation:** Pass `log: nodeEnv === 'production' ? ['warn','error'] : ['query','warn','error']` and forward to Pino. Use Prisma's middleware-based slow-query detector for prod.
**Suggested Fix Scope:** Small

### [P2] `moderation.service.ts` uses `tx.$queryRaw` for row locking — fine, but no comment explains the lock strategy
**Evidence:** `src/moderation/moderation.service.ts:99` (`SELECT ... FOR UPDATE`)
**Issue:** Hand-rolled raw lock query. Correct, but unaccompanied — newcomer modifying this might break the lock semantics.
**Impact:** Maintenance risk only.
**Recommendation:** Add a comment block explaining the lock + reproducible failure mode if removed.
**Suggested Fix Scope:** Small

### [P3] `recommendations.repository.ts` does three `$queryRaw` calls — schema is hand-typed via TS generics
**Evidence:** `src/recommendations/recommendations.repository.ts:49, 112, 178`
**Issue:** Raw SQL with TS generics is correct for performance/complex joins, but bypasses Prisma's type system. Any schema change can break runtime.
**Impact:** Risk of silent runtime errors on schema drift.
**Recommendation:** Add E2E coverage that runs each `$queryRaw` against a real DB; document why raw SQL was chosen (recsys aggregates, presumably).
**Suggested Fix Scope:** Small

---

## Outbox, Background Jobs & Idempotency

### [P1] `OutboxProcessor.claimEvents` does `SELECT ... FOR UPDATE SKIP LOCKED` followed by `UPDATE ... attempts = attempts + 1` ⇒ attempts increment before processing
**Evidence:** `src/outbox/outbox.processor.ts:130-170`
**Issue:** The attempts counter increments on every claim, regardless of whether dispatch succeeds. If dispatch fails, the next claim will see `attempts = previous + 1` and the loop will eventually move the event to dead-letter even though no business-logic error happened (e.g. a transient ES outage gets counted as a permanent failure).
**Impact:** Premature dead-lettering on transient downstream outages.
**Recommendation:** Increment `attempts` only on dispatch failure, not on claim. Or: keep claim-side increment but reset on success.
**Suggested Fix Scope:** Small

### [P2] Dispatcher uses `case ...` switch over event types with `as` casts on payload — no schema-validation per event type
**Evidence:** `src/outbox/outbox.processor.ts:170-260+`
**Issue:** Each event payload is `as { jobId: string }` etc. There's no Zod/class-validator schema for events. A malformed event (e.g. produced by older code) silently crashes the dispatcher and gets retried/dead-lettered.
**Impact:** Hard-to-diagnose dispatcher crashes; no clear contract for what payload an event carries.
**Recommendation:** Define event schemas (Zod) per `eventType`, validate at emit-time and at dispatch-time. Adds clear contracts and prevents data drift.
**Suggested Fix Scope:** Medium

### [P2] No metrics on outbox lag, dead-letter rate, or processing latency
**Evidence:** Only `HealthService.checkOutbox` exposes count of pending events.
**Issue:** Operators cannot graph "events processed per minute", "p95 dispatch latency", "dead-letter rate" without parsing logs. OpenTelemetry meters exist (`@opentelemetry/sdk-metrics`) but no meters are defined in code.
**Impact:** Limited observability of the most important reliability subsystem.
**Recommendation:** Add counters (`outbox.events.processed`, `outbox.events.failed`, `outbox.events.dead_lettered`), histograms (`outbox.dispatch.duration_ms`), and a gauge (`outbox.pending.count`).
**Suggested Fix Scope:** Medium

### [P2] `IdempotencyService.cleanup` runs hourly but has no jittered start ⇒ all worker pods cleanup at the same minute mark
**Evidence:** `src/outbox/idempotency.service.ts:43-55` (`@Cron(EVERY_HOUR)`)
**Issue:** With multiple worker replicas, all of them run cleanup simultaneously every hour, hammering the same `DELETE FROM idempotency_keys`. Same applies to `media-cleanup` `EVERY_5_MINUTES`.
**Impact:** Predictable spike of DELETEs every hour; small but real.
**Recommendation:** Either gate cron jobs to one replica (cron leadership lock via Redis SET NX EX), or randomize the start within the cron window (`@Interval` with jitter), or coordinate via the outbox itself.
**Suggested Fix Scope:** Medium

### [P2] No DLQ replay tooling exposed in the admin/moderation surface
**Evidence:** `src/outbox/dead-letter.service.ts` (verified to exist) + no controller endpoint that calls replay
**Issue:** "Manual replay" is mentioned in `architecture.md` but there's no admin endpoint to invoke it. Operators have to run a SQL update by hand.
**Impact:** On incident, recovery is slow and error-prone.
**Recommendation:** Add `POST /admin/outbox/dead-letter/:id/replay` with strong admin RBAC + audit log. Document in runbooks.
**Suggested Fix Scope:** Medium

---

## Performance & Scalability

### [P2] `CompaniesService.followCompany` keeps `followerCount` consistent via `increment`, but list/feed counts use a different denormalized field on `User` (e.g. follow counts) — verify symmetry
**Evidence:** `prisma/schema.prisma:578-622` (Company), grep `followingCount` returns 0 results
**Issue:** Companies have a denormalized `followerCount`; users have no equivalent `followingCount` (the Follow model is N:M). Inconsistent design: dashboards that show "you follow N companies" require a `count()` query each time.
**Impact:** Aggregate queries on hot dashboards. Inconsistent denormalization conventions.
**Recommendation:** Decide on one approach (always count from join table, or always denormalize). Document the choice.
**Suggested Fix Scope:** Medium

### [P2] Outbox dispatcher serializes events within a batch — no parallelism per batch
**Evidence:** `src/outbox/outbox.processor.ts:86-122` (`for (const event of events)`)
**Issue:** Inside one poll cycle, events are processed strictly sequentially. A slow downstream (ES bulk insert) blocks the rest of the batch even though they could run in parallel.
**Impact:** Higher tail latency for outbox dispatch.
**Recommendation:** Use `Promise.allSettled(events.map(dispatch))` with a concurrency cap. Or partition events by `aggregateType` and dispatch each partition in parallel.
**Suggested Fix Scope:** Medium

### [P2] No connection-pool tuning for Prisma / Postgres
**Evidence:** `src/infra/prisma/prisma.service.ts` uses defaults; `DATABASE_URL` includes no `connection_limit`
**Issue:** Prisma default pool is `num_physical_cpus * 2 + 1`. For a worker doing outbox polling + transactional writes + media + scheduled cleanups, you may exhaust the pool under load.
**Impact:** `Timed out fetching a new connection` errors in production.
**Recommendation:** Set `connection_limit` in `DATABASE_URL` (e.g. `?connection_limit=20`), document recommended values per role, and add a saturating-pool health check.
**Suggested Fix Scope:** Small

### [P3] Cookies for refresh token are bound to `/api/v1/auth` path
**Evidence:** `src/auth/auth.controller.ts:72`
**Issue:** Reasonable scoping, but if the API prefix changes (e.g. multi-tenant via subdomain), the cookie path needs to change too. Hardcoded.
**Impact:** Future refactor pain.
**Recommendation:** Compute the cookie path from `apiPrefix` via ConfigService.
**Suggested Fix Scope:** Small

---

## Observability & Logging

### [P1] Pino logs the full `req.url` including query string — tokens passed in query (`?token=...`) end up in logs
**Evidence:** `src/infra/logger/logger.module.ts:50, 62, 68` (req serializer + custom messages)
**Issue:** The `req` serializer logs `url: req.url ?? ''`. WebSocket connection handshake passes the token via query string. While the gateway sits on Socket.IO and not Express HTTP logging, any HTTP route that accepts a token query (none today, but a future short-lived download URL would) would log it.
**Impact:** Future leak surface.
**Recommendation:** Strip known token-bearing query params from logs. Better: ban tokens in query strings entirely (see WebSocket finding above) and document in `AGENTS.md`.
**Suggested Fix Scope:** Small

### [P1] No log line on uncaught/normalized 500 errors
**Evidence:** `src/common/errors/api-exception.filter.ts` does not log
**Issue:** Same as the API Contract finding above; mentioned here for emphasis on observability.
**Impact:** Unobservable 500s.
**Recommendation:** Inject `PinoLogger` and log every non-HttpException with `error.stack`.
**Suggested Fix Scope:** Small

### [P2] OpenTelemetry exporter URL is read directly from `process.env` in `instrumentation.ts` ⇒ no validation; missing endpoint silently degrades
**Evidence:** `src/instrumentation.ts:56, 70`
**Issue:** `OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT })` — if env is missing or wrong, the exporter is constructed with `undefined` URL, falls back to defaults (`http://localhost:4318`), and you get no traces in prod.
**Impact:** Silent observability gap.
**Recommendation:** Validate `OTEL_EXPORTER_OTLP_ENDPOINT` at instrumentation startup; fail-fast if missing in production.
**Suggested Fix Scope:** Small

### [P2] No structured `event` for security-relevant actions (login success/failure, token revoke, role change)
**Evidence:** `audit_logs` exists, but no dedicated security-event log channel
**Issue:** Login failures (wrong password) are not logged with a specific `event=security.auth.failed` tag — making it hard to feed a SIEM. Same for repeated 401 from the same IP/user.
**Impact:** Limited security observability.
**Recommendation:** Add a `securityEvents` Pino child logger and emit on every auth-relevant outcome. Forward to SIEM.
**Suggested Fix Scope:** Medium

### [P3] PII redaction is path-based but `screeningAnswers[*].answer` may not match nested arrays of objects depending on Pino version
**Evidence:** `src/infra/logger/logger.module.ts:23, 30-33`
**Issue:** Pino's `redact.paths` supports limited wildcard semantics. `'*.coverLetter'` matches `req.body.coverLetter`, but `'*.screeningAnswers[*].answer'` may not match nested under arrays at depths >1.
**Impact:** Risk of unredacted sensitive data in logs.
**Recommendation:** Verify with a unit test that posts a real `screeningAnswers` array and asserts redaction. The existing `logger.module.spec.ts` should be expanded.
**Suggested Fix Scope:** Small

---

## Tests & CI

### [P1] `npm test` crashes without env vars set — every fresh contributor hits this
**Evidence:** Local `npm test` (no env) ⇒ `Missing required environment variable: PORT` mid-run during `src/common/common.spec.ts`. Tests pass cleanly once all env vars are exported.
**Issue:** One or more `.spec.ts` files transitively imports `validateEnv` (likely via `AppModule` / `ConfigModule.forRoot({ validate })`). Without env, the throw kills the worker process. CI hides this because it sets every env var.
**Impact:** Onboarding friction; flaky local test runs.
**Recommendation:** Either add a `jest.setup.ts` with a minimal valid env or guard `validateEnv` to skip in test mode. Document required env in CONTRIBUTING/README.
**Suggested Fix Scope:** Small

### [P1] CI script `npm run lint` includes `--fix` and CI succeeds despite 157 warnings
**Evidence:** `package.json` `"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"`; `.github/workflows/ci.yml` runs `npm run lint`
**Issue:** Two problems in one:
1. `--fix` modifies files in CI. If a runner is misconfigured to push the working tree, fixes leak in. More importantly, "lint" is not a verification step anymore — it's a *mutation*.
2. `eslint --max-warnings 0` is *not* enforced. ESLint exits 0 on warnings. 157 warnings ride green.

**Impact:** Lint is decorative. Real safety regressions (unsafe `any` in `auth.service.ts`, floating promises in tests) sneak in.
**Recommendation:** Rename `lint` → `lint:fix` and add a new `lint: "eslint ... --max-warnings 0"`. Use the strict one in CI. Promote `no-floating-promises` and `no-unsafe-argument` to `error`.
**Suggested Fix Scope:** Small

### [P1] CI `test:e2e` runs with no MinIO / Elasticsearch / MailHog services ⇒ tests must either mock heavily or skip
**Evidence:** `.github/workflows/ci.yml` services section: only `postgres` and `redis`. But the env vars set `S3_ENDPOINT=http://localhost:9000`, `ELASTICSEARCH_NODE=http://localhost:9200`, `SMTP_HOST=smtp.example.com`.
**Issue:** Unless every `*.e2e-spec.ts` mocks S3/ES/SMTP, the e2e step is either silently degraded or relies on connection refusals being non-fatal in test mode.
**Impact:** False sense of e2e coverage. Real bugs in S3/ES/mailer integrations won't be caught in CI.
**Recommendation:** Add `services: minio`, `services: elasticsearch`, `services: mailhog` to the CI workflow, or use Testcontainers for these (the project already has `@testcontainers/postgresql`). Better yet: split e2e tests into "fast (mocked infra)" and "slow (real infra via Testcontainers)" suites.
**Suggested Fix Scope:** Medium

### [P1] Deploy workflow is a no-op
**Evidence:** `.github/workflows/deploy.yml` — only `build` job; deploy steps are commented placeholders.
**Issue:** No actual deployment exists. Image is built but never pushed anywhere. The project claims "production readiness" but has no production target wired up.
**Impact:** Pipeline gives false confidence.
**Recommendation:** Either delete the deploy workflow until needed, or wire it to a real target (ECR/GCR + ECS/k8s). Add `prisma migrate deploy` as a pre-deploy step.
**Suggested Fix Scope:** Large (needs infra decisions)

### [P2] Security workflow only runs `npm audit --audit-level=high` — no SAST, no dependency review, no container scan
**Evidence:** `.github/workflows/security.yml`
**Issue:** CodeQL, dependency-review, Trivy/Snyk are all commented out. No SBOM, no container image vulnerability scan.
**Impact:** Vulnerabilities discovered late, possibly in production.
**Recommendation:** Enable CodeQL for JS/TS, Trivy for `Dockerfile` + image, npm audit with `--audit-level=moderate`, Dependabot for npm + Docker base images.
**Suggested Fix Scope:** Medium

### [P2] `jest` config in `package.json` collects coverage from `**/*.(t|j)s` without excluding `dto/`, `module.ts`, `index.ts`
**Evidence:** `package.json` `"collectCoverageFrom": ["**/*.(t|j)s"]`
**Issue:** Coverage numbers are diluted by trivial files (DTO classes, module wiring, barrel exports). Reported coverage is below real coverage.
**Impact:** Mis-set quality gates.
**Recommendation:** Add `"coveragePathIgnorePatterns": ["dto/", ".*\\.module\\.ts$", ".*\\.dto\\.ts$", "index\\.ts", ".*\\.constants\\.ts$"]`.
**Suggested Fix Scope:** Small

### [P2] No coverage threshold configured
**Evidence:** `package.json` jest section has no `coverageThreshold`
**Issue:** CI doesn't fail on coverage regressions.
**Impact:** Coverage can silently degrade over time.
**Recommendation:** Set `coverageThreshold: { global: { lines: 80, functions: 80, branches: 70, statements: 80 } }` after measuring real numbers; enforce in CI.
**Suggested Fix Scope:** Small

### [P3] `e2e` tests have not been verified to run end-to-end against real infra in this audit
**Evidence:** N/A — required containers (MinIO/ES/SMTP) not available in the audit VM.
**Issue:** Not a code issue; audit limitation.
**Recommendation:** Run `docker-compose up -d && npm run test:e2e` locally as a smoke check.
**Suggested Fix Scope:** N/A

---

## Deployment & Runtime Config

### [P1] Dockerfile copies whole source, runs `npm ci` again in runtime stage, runs as root
**Evidence:** `Dockerfile`
**Issue:**
- Two `npm ci` invocations (one in builder, one in runtime) duplicate work and increase image build time.
- Runtime stage runs as root (`USER` directive missing).
- No `HEALTHCHECK` defined.
- `ENV APP_PROCESS_ROLE=all` baked into the image — production should override per service.
- No `prisma migrate deploy` step; migrations must be run separately, but no clear convention.

**Impact:** Larger attack surface (root), slower image builds, ambiguous migration story.
**Recommendation:**
```Dockerfile
# runtime stage
RUN addgroup -S app && adduser -S app -G app
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health/live || exit 1
```
Remove the duplicate `npm ci`. Decide migration ownership (option A: separate `migrate` container that runs `prisma migrate deploy` before app starts; option B: app runs migrate on boot — discouraged for multi-pod deploys).
**Suggested Fix Scope:** Medium

### [P2] `docker-compose.yml` uses default MinIO root credentials in env interpolation defaults
**Evidence:** `docker-compose.yml` `MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}`
**Issue:** Defaulting to well-known credentials is OK for local dev but operators may not realize they should override. Same for `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-mdc_dev_password}`.
**Impact:** Risk of accidentally deploying compose against shared infrastructure with default credentials.
**Recommendation:** Remove defaults; require explicit env. Add a `compose.prod.yml` for production-flavored overrides.
**Suggested Fix Scope:** Small

### [P2] `.env.example` exposes 32+ env vars without indicating which are required in production vs dev-only
**Evidence:** `.env.example`
**Issue:** No annotation of which vars are required, optional, or have defaults. `OTEL_EXPORTER_OTLP_ENDPOINT` is required at the schema level but not flagged as production-critical.
**Impact:** Misconfigured prod deploys.
**Recommendation:** Group env vars by section + add `# REQUIRED` / `# OPTIONAL` / `# PRODUCTION ONLY` annotations.
**Suggested Fix Scope:** Small

### [P2] No graceful shutdown for outbox processor mid-batch
**Evidence:** `src/outbox/outbox.processor.ts:74` (`@Cron(..., { waitForCompletion: true })`), `src/main.ts` `app.enableShutdownHooks()`
**Issue:** `waitForCompletion: true` is good — it prevents two batches overlapping. But there's no signal-aware abort: if SIGTERM arrives mid-batch, the leased events stay locked until `lease-timeout`. The next replica will wait the full lease timeout before re-claiming.
**Impact:** Delayed event processing on rolling deploys.
**Recommendation:** On `OnApplicationShutdown`, release any owned locks (`UPDATE outbox_events SET status='PENDING', locked_at=NULL, locked_by=NULL WHERE locked_by = $myLockId`).
**Suggested Fix Scope:** Medium

### [P2] `instrumentation.ts` SIGTERM handler exits the process unconditionally — bypasses NestJS shutdown hooks
**Evidence:** `src/instrumentation.ts:79-87`
**Issue:** On SIGTERM, instrumentation calls `sdk.shutdown()` then `process.exit(0)`. NestJS shutdown hooks (Prisma `$disconnect`, ioredis `quit`, etc.) may not run before exit.
**Impact:** Dropped connections, possibly mid-flight transactions.
**Recommendation:** Let NestJS handle SIGTERM (via `app.enableShutdownHooks()`), and shut OTel down in an `onApplicationShutdown` provider.
**Suggested Fix Scope:** Small

---

## Maintainability & Developer Experience

### [P1] `tsconfig.json` does NOT enable `strict: true`
**Evidence:** `tsconfig.json` — only `strictNullChecks`, `noImplicitAny`, `strictBindCallApply`
**Issue:** The project comment in `package.json` AGENTS.md claims "strict TypeScript", but `strict: true` is not on. Missing: `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`.
**Impact:** Many latent type bugs. `catch (e)` blocks treat `e` as `any` instead of `unknown` (which the project then mitigates by ad-hoc `as { code?: string }` casts — see `companies.service.ts:113-126`).
**Recommendation:** Set `"strict": true`. Additionally enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Fix the resulting errors incrementally per module.
**Suggested Fix Scope:** Medium

### [P1] ESLint disables `@typescript-eslint/no-explicit-any` globally
**Evidence:** `eslint.config.mjs` line `'@typescript-eslint/no-explicit-any': 'off'`
**Issue:** The single most important type-safety rule for a TS project is turned off. Result: 152 `as any` casts in code (134 of them in tests, ~18 in production code).
**Impact:** Type-safety is opt-in instead of default. Real-world bugs (the `tx as any` pattern across the codebase) become invisible to the linter.
**Recommendation:** Promote to `error`. Fix the production-code `as any` instances by tightening `PrismaTransaction` first (see Database section). Keep test files exempt via the existing override.
**Suggested Fix Scope:** Medium

### [P2] `eslint.config.mjs` downgrades `no-floating-promises` and `no-unsafe-argument` to `warn`
**Evidence:** `eslint.config.mjs:33-35`
**Issue:** Floating promises are a Node.js footgun, especially for the outbox + cron + async event-emit patterns the project relies on. `no-unsafe-argument` is the second-line defense against `any` casts.
**Impact:** Promises that don't await get silently swallowed (e.g. `outboxService.emit(...)` without await would lose events).
**Recommendation:** Promote both to `error`.
**Suggested Fix Scope:** Small

### [P2] No `npm run check` umbrella script
**Evidence:** `package.json` scripts — separate `typecheck`, `lint`, `test`
**Issue:** Contributors must remember three commands to validate before pushing.
**Recommendation:** Add `"check": "npm run typecheck && npm run lint && npm test"`. Document as the pre-commit invocation.
**Suggested Fix Scope:** Small

### [P2] Multiple TODOs in production code paths without tracking tickets
**Evidence:** `src/recommendations/recommendations.service.ts:110, 359`, `src/outbox/processors/profile-creation.processor.ts:37`, `src/analytics/dto/analytics-response.dto.ts:11, 13`
**Issue:** Five TODOs that suggest deliberate "TBD" gaps. None linked to a beads issue.
**Impact:** Knowledge drift; gaps may be missed at release.
**Recommendation:** Convert each TODO to a `bd create` ticket with link in the comment.
**Suggested Fix Scope:** Small

### [P2] `prisma/schema.prisma` is 1800 lines, no logical grouping or comments per domain
**Evidence:** `prisma/schema.prisma`
**Issue:** Hard to navigate; relations on the `User` model alone are 64 lines of `@relation` ambiguity. Prisma's schema supports comments but they're sparse.
**Impact:** High cognitive load when adding a new field/relation.
**Recommendation:** Add `// region: Auth & RBAC` / `// region: Profiles` / etc. block comments. Consider Prisma's `multiFile` schema layout (experimental in v6) once stable.
**Suggested Fix Scope:** Medium

### [P3] README is the default `NestJS` starter — does not describe the actual project
**Evidence:** `README.md`
**Issue:** README is generic. Contributors learn nothing about the domain, how to run, or how the project is structured.
**Impact:** Bad first impression; relies entirely on `AGENTS.md` (which is excellent but not what new humans look at first).
**Recommendation:** Replace README with a project-specific summary, link to `AGENTS.md` and `docs/architecture.md`, include the "first 10 minutes" setup commands.
**Suggested Fix Scope:** Small

### [P3] `package.json` `description` and `author` are empty; license is `UNLICENSED`
**Evidence:** `package.json`
**Issue:** Cosmetic but signals "scaffolded project".
**Recommendation:** Populate.
**Suggested Fix Scope:** Small

---

# Quick Wins (10 small, high-value tasks)

Each should be a single small PR.

| # | Task | Files | Win |
|---|------|-------|-----|
| 1 | Set `"strict": true` in `tsconfig.json` and fix the resulting errors per module | `tsconfig.json`, various | Catches dozens of latent bugs |
| 2 | Change `PrismaTransaction = Prisma.TransactionClient` and remove every `tx as any` | `src/infra/prisma/prisma.service.ts`, all `src/**/*.service.ts` with outbox emit | Restores type safety across the codebase |
| 3 | Make `lint` mean "verify", add `lint:fix` for the auto-fix; CI runs `--max-warnings 0` | `package.json`, `.github/workflows/ci.yml` | CI lint becomes meaningful |
| 4 | Add a `jest.setup.ts` that sets a known-good test env, so `npm test` works out of the box | `jest.config`/`package.json`, new `jest.setup.ts` | Removes #1 onboarding paper cut |
| 5 | Inject `PinoLogger` into `ApiExceptionFilter` and log non-HttpException with stack | `src/common/errors/api-exception.filter.ts` | Stops silent 500s |
| 6 | Fix Pino `genReqId` to honor `x-request-id` header so logs match response headers | `src/infra/logger/logger.module.ts`, `src/bootstrap.ts` | Trace ID consistency |
| 7 | Increase global throttler from 10/min to 300/min | `src/app.module.ts` | Unblocks real users |
| 8 | Remove the `JSON.stringify(request.body)` fallback in webhook signature guard | `src/billing/webhooks/webhook-signature.guard.ts` | Hard-fails misconfiguration |
| 9 | Move `idempotencyService.claim` inside the surrounding `$transaction` and accept `tx` | `src/outbox/idempotency.service.ts`, callers | Idempotency consistent with transactions |
| 10 | Add `HEALTHCHECK` + non-root user to `Dockerfile` | `Dockerfile` | Production hygiene |

---

# Refactor / Improvement Roadmap

## Phase 1 — Safety & Correctness (must-do before public traffic)

**Goals:** Fix the broken/insecure auth, idempotency, and media-authorization paths. Make the type system actually work.

**Tasks:**
1. Refresh-token rotation: add `familyId` + `parentTokenId` columns, rewrite `validateAndRotateRefreshToken` to lookup by token-id, remove the Bearer requirement on refresh, sign refresh tokens with `JWT_REFRESH_SECRET` (or drop it from config).
2. Media authorization: add `visibility` to `MediaAsset` (or derive via reverse relations), allow public reads through a separate URL path.
3. Idempotency: accept `tx` parameter, run inside the surrounding transaction.
4. `PrismaTransaction = Prisma.TransactionClient`; remove all production-code `tx as any`.
5. `tsconfig.json` `"strict": true`; ESLint `no-explicit-any: error` for production files.
6. CI: `npm run lint` becomes verify-only with `--max-warnings 0`.
7. `ApiResponseInterceptor` bypass for `/billing/webhooks/*`.
8. Webhook signature guard: hard-fail when raw body missing.

**Files likely touched:** `src/auth/**`, `src/outbox/idempotency.service.ts`, `src/media/**`, `src/infra/prisma/prisma.service.ts`, all callers of `OutboxService.emit`, `tsconfig.json`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `prisma/schema.prisma` (+ new migration).

**Verification commands:**
```bash
npm run typecheck
npm run lint           # after script change → must be verify-only
npm test
npm run test:e2e       # if local docker-compose is up
npm run build
npx prisma validate    # with DATABASE_URL set
npx prisma migrate dev # if schema migrations are added
```

**Risk level:** Medium — touches auth and DB schema. Required.

## Phase 2 — Production Readiness

**Goals:** Make the deploy/observability path real. Add the operational guardrails that turn this from "feature-complete" into "runnable in production".

**Tasks:**
1. Dockerfile: non-root user, `HEALTHCHECK`, drop duplicate `npm ci`, decide migration strategy.
2. Real deploy workflow (or delete the placeholder).
3. CI services: add MinIO + Elasticsearch + MailHog or move e2e to Testcontainers.
4. Security workflow: add CodeQL, Trivy, Dependabot, `npm audit` at `moderate`.
5. OpenTelemetry: validate `OTEL_*` env at startup; add outbox metrics (counters, histograms).
6. Logger: fix request-ID propagation; log on 500s; verify PII redaction with a focused test.
7. Throttler: tune global default + document per-route.
8. Helmet: add minimal CSP.
9. Graceful shutdown: release outbox locks on SIGTERM.
10. README: rewrite to actually describe the project.

**Files likely touched:** `Dockerfile`, `docker-compose.yml`, `.github/workflows/*.yml`, `src/instrumentation.ts`, `src/infra/logger/*`, `src/bootstrap.ts`, `src/app.module.ts`, `src/outbox/outbox.processor.ts`, `README.md`.

**Verification commands:**
```bash
npm run check         # if added in Phase 1
docker build .        # verify Dockerfile changes
docker compose up -d  # spin up services
npm run test:e2e
curl -fsS http://localhost:3000/health/ready
```

**Risk level:** Medium-Low — additive infra/devops changes.

## Phase 3 — Scalability & Maintainability

**Goals:** Make the outbox and DB scale, simplify the maintenance surface.

**Tasks:**
1. Outbox: parallel dispatch per batch with bounded concurrency; per-event-type schemas (Zod) at emit and dispatch.
2. Outbox: increment `attempts` only on dispatch failure; emit telemetry metrics.
3. DLQ: admin endpoint for replay; runbook in `docs/runbooks/`.
4. Prisma: configurable connection pool size per role; transaction `timeout`/`maxWait` set on heavy transactions.
5. Prisma: log slow queries via PinoLogger.
6. Companies: pick a single slug-generation helper; drop the `count`-then-create version.
7. Companies: decide on denormalized counters or `_count` everywhere.
8. Schema regions/comments in `prisma/schema.prisma`.
9. ScheduleModule gating: per-role granularity (cron / interval / cleanup).
10. Cron leader election (Redis SETNX EX) to prevent stampeding cleanups across worker replicas.

**Files likely touched:** `src/outbox/**`, `src/infra/prisma/**`, `src/companies/companies.service.ts`, `src/app.module.ts`, `prisma/schema.prisma`, `docs/runbooks/**`.

**Verification commands:**
```bash
npm run check
npm run test:e2e
# load-test outbox throughput before/after
```

**Risk level:** Medium — refactors hot paths.

## Phase 4 — Long-term Architecture

**Goals:** Set up the project for the next 12 months.

**Tasks:**
1. Boundary enforcement: `eslint-plugin-boundaries` or `no-restricted-imports` to forbid cross-domain imports beyond approved ports.
2. Extract reusable policy/ports into `src/common/policies` (RBAC/RLS interfaces).
3. Event schema registry — versioned event payloads (`UserRegistered.v1`, `.v2`).
4. Idempotency middleware exposed via `Idempotency-Key` header on all unsafe POSTs.
5. Multi-region / multi-tenant readiness: tenant ID propagation in headers, logs, and DB row-level filters.
6. Optional: split high-traffic modules (feed, messaging, search) into separate services backed by Kafka/NATS once outbox throughput plateaus.
7. Move `prisma/schema.prisma` to multi-file layout once stable.

**Files likely touched:** `src/**`, `prisma/schema.prisma`, new `src/contracts/` for event schemas, `docs/architecture.md`.

**Verification commands:**
```bash
npm run check
npm run test:e2e
```

**Risk level:** High — architectural moves.

---

# Test Gap Analysis

## Unit test gaps

| Area | Gap |
|------|-----|
| `auth/token.service.ts` | Tests exist (`token.service.spec.ts` PASS) but do not cover multi-device sessions; the bug described in [P0] above is not detected by current tests. **Add a test:** "two devices refreshing concurrently each keep their own session." |
| `idempotency.service.ts` | Tests exist (PASS) but do not assert behaviour inside a rolled-back transaction. **Add a test:** "claim rolls back when caller's transaction fails." |
| `webhook-signature.guard.ts` | No test for the `JSON.stringify` fallback case. **Add a test:** "guard rejects when raw body missing." |
| `media.service.ts` | Owner-only tests exist; no negative test for public asset access. **Add a test:** "non-owner reading a referenced-by-public-Post asset should succeed once visibility model lands." |
| `outbox.processor.ts` | Tests cover claim/dispatch/dead-letter, but not "transient failure shouldn't increment attempts". Add a test for the [P1] attempts-counter bug. |
| `api-exception.filter.ts` | No assertion that 500s are logged. |

## E2E test gaps

| Area | Gap |
|------|-----|
| Cross-device session | Two `supertest` agents simulating two devices, refreshing concurrently |
| Webhook end-to-end | No test sends a real signed payload + asserts the outbox event lands |
| Throttler | No test asserts that the global throttler kicks in at the configured limit |
| Refresh without Bearer | Today the controller throws; add a regression test for the eventual fix |
| Media public access | Test posting a public Post with a media reference, anonymous user fetches the media URL |
| Outbox dead-letter | E2E that injects a failing handler and asserts the row moves to dead-letter and an admin replay endpoint works |

## Security / auth test gaps

- Replay attack on refresh: same refresh token presented twice → only one wins; the second triggers family revocation.
- CSRF on `/auth/refresh` from a cross-origin form (without CORS allowed).
- WS connection without auth → disconnect.
- WS connection with expired token → disconnect.
- Webhook with bad signature → 401.
- Webhook with old timestamp (>5 min) → 400.
- Admin endpoint without RolesGuard authorization → 403.
- Email verification flow: unverified user attempting an `@EmailVerifiedGuard`-protected route returns 403, not 401.

## Regression tests to add (linked to findings)

- "`OutboxService.emit` is awaited everywhere" — a lint rule (`no-floating-promises: error`) suffices.
- "`PrismaTransaction` is `Prisma.TransactionClient`" — typecheck would catch it.
- "Refresh-cookie path is the configured API prefix" — unit test on `auth.controller.ts`.

## Highest-priority tests to add first

1. Two-device refresh test (regression for [P0]).
2. Webhook raw-body required test (regression for [P1]).
3. Idempotency rollback test (regression for [P1]).
4. Outbox attempts-counter test (regression for [P1]).
5. Media public-access test (validates Phase 1 fix).

---

# Verification Results

Commands run in the audit environment with `DATABASE_URL` and other required env vars set to safe placeholder values where appropriate.

| Command | Result | Notes |
|---------|--------|-------|
| `npm ci` | PASS | 1126 packages installed in 14s. Warns on Node.js engine compatibility for `eslint-visitor-keys` (current Node v22.12.0 vs required `^20.19.0 \|\| ^22.13.0 \|\| >=24`). Not blocking but ought to align. |
| `npx prisma generate` | PASS | Prisma Client v6.19.3 generated. |
| `npx prisma validate` | PASS (with `DATABASE_URL` set) | Schema is valid. Without `DATABASE_URL` it fails with P1012 — Prisma resolves env at validate-time. |
| `npm run typecheck` | **PASS** | `tsc --noEmit` exits 0. **However, this is a weak signal** because `tsconfig.json` does not enable `strict` — many issues are not caught. |
| `npm run lint` (as defined: `eslint --fix`) | PASS (exits 0) but **misleading** | Auto-fixes files. Cleanly green. |
| `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0` | **FAIL** | **157 problems (0 errors, 157 warnings)**. ESLint fails the run because of the `--max-warnings 0` flag. Of those, 2 warnings are in production `src/auth/auth.service.ts` (unsafe argument). |
| `npm run build` | PASS | `nest build` produces `dist/`. |
| `npm test` (no env) | **FAIL** | Crashes mid-run with `Missing required environment variable: PORT` (then `OTEL_EXPORTER_OTLP_ENDPOINT` after adding PORT). Some `.spec.ts` transitively bootstraps `validateEnv`. |
| `npm test` (with full env) | **PASS** | **75 test suites, 739 tests passed in 7.6 s.** |
| `npm run test:e2e` | SKIPPED | The audit VM does not have docker-compose services running (Postgres, Redis, MinIO, ES, SMTP). E2E specs assume real infra or heavily mocked variants. Re-run locally after `docker compose up -d`. |

**Environment vs code:** The lint failure and `npm test` env crash are **code/script issues**, not environment issues — they reproduce on any machine without the full env exported, including a contributor's first day.

---

# Post-Audit Implementation Results

## Phase 1 Result

Changed:
- `src/infra/prisma/prisma.service.ts:13` — `PrismaTransaction` now aliases `Prisma.TransactionClient`, matching Prisma interactive transactions.
- `src/outbox/outbox.service.ts:14` — `OutboxService.emit` accepts typed transaction clients directly and no longer needs a runtime transaction-shape guard.
- `package.json:16` — `lint` is verify-only with `--max-warnings 0`; `lint:fix` is the mutating script; `check` runs typecheck, lint, and unit tests.
- `package.json:120` — Jest loads `../jest.setup.ts` before module imports so tests get safe env defaults without manual exports.
- `package.json:123` — coverage now ignores DTO/module/barrel/constants files and enforces measured global thresholds.
- `tsconfig.json:19` — `strict` mode is enabled.
- `eslint.config.mjs:29` — `no-explicit-any`, `no-floating-promises`, and `no-unsafe-argument` are errors; spec/e2e files keep a documented mock-heavy override.
- `jest.setup.ts:1` — unit-test env defaults cover database, Redis, S3, Elasticsearch, SMTP, OTel, auth, cookie, and billing config.
- `test/AGENTS.md:16` — testing docs now point to `../jest.setup.ts`; `test/AGENTS.md:46` documents env-default behavior.
- `src/realtime/socket-auth-token.ts:7` — shared typed Socket.IO token extraction removed production unsafe-assignment/member-access suppressions in realtime gateways.
- `src/auth/auth.controller.ts:103` — decoded JWT payload is treated as `unknown` and narrowed before reading `sub`.

Verification:
- `npm run check` — pass; strict typecheck, lint with zero warnings, unit tests 75 suites / 739 tests.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `npm run test:cov -- --runInBand --coverageReporters=json-summary` — pass; lines 64.76%, statements 65.53%, functions 62.62%, branches 55.37%.
- temp copy without `.env`, run with clean process env: `npm test -- --runInBand` — pass; 75 suites / 739 tests.
- `rg -n "tx as any" src --glob '*.ts'` — no matches.
- `rg -n "as any|: any|<any>|@ts-ignore|eslint-disable" src --glob '*.ts' --glob '!*.spec.ts'` — no matches.
- planted temporary `src/__lint_probe.ts` with explicit `any`; `npm run lint` failed as expected, then probe was removed and `npm run lint` passed again.

Remaining:
- none for Phase 1.
- Future-phase target checks still find planned Phase 5 work: Socket.IO query-token fallback.

## Phase 2 Result

Changed:
- `src/auth/auth.controller.ts:12` — `AuthController` now injects `ConfigService<AppConfig, true>` for refresh-cookie config instead of reading ambient env.
- `src/auth/auth.controller.ts:70` — login refresh-cookie options now come from validated config.
- `src/auth/auth.controller.ts:142` — refresh endpoint reuses the same validated cookie options when rotating the cookie.
- `src/auth/auth.controller.ts:225` — refresh-cookie `maxAge` now derives from `jwtRefreshExpiresIn`.
- `src/auth/token-expiry.util.ts:3` — shared `expiresIn` parser returns milliseconds for cookies and dates for refresh-token expiry.
- `src/auth/token.service.ts:8` — refresh-token expiry now uses the shared parser instead of duplicate private parsing.
- `src/auth/auth.controller.spec.ts:114` — regression test proves login cookie uses `cookieSecure`, `cookieSameSite`, and `jwtRefreshExpiresIn` from `ConfigService`.
- `src/auth/auth.guard.ts:62` — invalid tokens on `@OptionalAuth()` routes now leave `request.user` unset and continue as anonymous.
- `src/auth/auth.guard.spec.ts:150` — regression test covers invalid optional-auth token degradation.
- `prisma/schema.prisma` — `RefreshToken` now has token identity fields for opaque refresh tokens: `familyId`, `parentTokenId`, SHA-256 token-secret hash storage, and family/parent indexes.
- `prisma/migrations/20260524093000_refresh_media_visibility_counts/migration.sql` — refresh-token backfill sets existing rows to self-rooted families for legacy dual-read compatibility.
- `src/auth/token.service.ts` — refresh tokens are now opaque `<tokenId>.<secret>` values; lookup uses token ID, validation hashes the secret with SHA-256, rotation preserves token families, and replay revokes only the affected family.
- `src/auth/token.service.ts` — legacy bcrypt refresh-token validation remains as a dual-read path for unexpired existing rows until natural expiry.
- `src/auth/auth.controller.ts` — `/auth/refresh` is cookie-only and no longer requires a Bearer access token or `jwtService.decode()` to infer refresh identity.
- `.env.example`, `jest.setup.ts`, `src/infra/config/*`, and workflow/test env — removed dead `JWT_REFRESH_SECRET` config after moving refresh tokens to opaque random secrets.

Verification:
- pre-fix `npm test -- auth.controller.spec.ts --runInBand` — failed as expected; cookie options were hardcoded to `secure: false`, `sameSite: 'lax'`, and 7-day maxAge.
- `npm test -- auth.controller.spec.ts token.service.spec.ts --runInBand` — pass; 2 suites / 8 tests.
- pre-fix `npm test -- auth.guard.spec.ts --runInBand` — failed as expected; invalid optional-auth token threw `UnauthorizedException`.
- `npm test -- auth.guard.spec.ts --runInBand` — pass; 1 suite / 8 tests.
- `npm run check` — pass; strict typecheck, lint with zero warnings, unit tests 75 suites / 740 tests.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `rg -n "process\\.env" src/auth --glob '*.ts'` — no matches.
- `npm test -- token.service.spec.ts auth.controller.spec.ts --runInBand` — pass; opaque refresh rotation, cookie-only refresh, replay revocation, expired/revoked handling, and legacy dual-read covered.
- `npm run test:e2e -- auth.e2e-spec.ts --runInBand` — pass.

Remaining:
- none for Phase 2.

## Phase 3 Result

Changed:
- `prisma/schema.prisma` — added `MediaVisibility` enum and `MediaAsset.visibility @default(PRIVATE)` with an index on `[visibility, status]`.
- `prisma/migrations/20260524093000_refresh_media_visibility_counts/migration.sql` — conservative backfill keeps uncertain assets `PRIVATE`, marks only company logo/cover media and published public post media `PUBLIC`.
- `src/media/media.controller.ts` — `GET /media/:id` now uses optional auth so anonymous requests can reach public media without weakening confirm/delete.
- `src/media/media.service.ts` — download authorization now allows anonymous `PUBLIC`, owner-only `PRIVATE`, and accepted-connection `CONNECTIONS_ONLY`; denied access still returns not found to avoid enumeration.
- `src/media/media.service.spec.ts` and `test/media.e2e-spec.ts` — added public-read/private-denial regression coverage.

Verification:
- `npx prisma validate` — pass.
- `npm test -- media.service.spec.ts --runInBand` — pass.
- `npm run test:e2e -- media.e2e-spec.ts --runInBand` — pass.

Remaining:
- none for Phase 3.

## Phase 4 Result

Changed:
- `src/billing/webhooks/webhook-signature.guard.ts:42` — guard now hard-fails when `rawBody` is missing and never stringifies parsed request body for signature verification.
- `src/billing/webhooks/webhook-signature.guard.spec.ts:68` — regression test covers missing raw body and proves signature verification is not called in that state.
- `src/common/response/api-response.interceptor.ts:15` — billing webhook route prefixes bypass the global API response envelope.
- `src/common/common.spec.ts:54` — regression test proves billing webhook responses pass through as provider-facing bodies rather than `{ data: ... }`.
- `src/outbox/idempotency.service.ts:11` — `claim` now supports both standalone and transaction-client calls so idempotency rows can roll back with their caller transaction.
- `src/billing/webhooks/webhook.service.ts:48` — webhook processing passes `tx` into the idempotency claim before provider-event persistence and outbox emit.
- `src/companies/companies.service.ts:167` — company creation now claims idempotency inside the same transaction as the company/member/outbox writes.
- `src/outbox/outbox.processor.ts:98` — dispatch failure now records one failed attempt before deciding requeue versus dead letter.
- `src/outbox/outbox.processor.ts:150` — claim SQL marks events `PROCESSING` without incrementing `attempts`.
- `src/outbox/outbox.processor.ts:454` — `recordFailure` increments `attempts` only on real dispatch failure and returns the updated count.
- `src/outbox/idempotency.service.spec.ts:1` — regression coverage for transaction-scoped idempotency claims.
- `src/billing/webhooks/webhook.service.spec.ts:1` — regression coverage for webhook idempotency using the provided transaction client.
- `src/companies/companies.service.spec.ts:1` — regression coverage for company-create idempotency inside the transaction.
- `src/outbox/outbox.processor.spec.ts:1` — regression coverage for claim-side attempts not incrementing and failure-side attempts incrementing once.

Verification:
- pre-fix `npm test -- webhook-signature.guard.spec.ts --runInBand` — failed as expected; missing `rawBody` did not throw.
- pre-fix `npm test -- common.spec.ts --runInBand` — failed as expected; `/api/v1/billing/webhooks/stripe` response was wrapped in `{ data: ... }`.
- `npm test -- common.spec.ts webhook-signature.guard.spec.ts webhook.service.spec.ts --runInBand` — pass; 3 suites / 20 tests.
- `npm test -- outbox.processor.spec.ts idempotency.service.spec.ts webhook.service.spec.ts companies.service.spec.ts --runInBand` — pass; 4 suites / 38 tests.
- `npm run check` — pass; strict typecheck, lint with zero warnings, unit tests 76 suites / 749 tests after Phase 4; latest full run after Phase 5 e2e-harness work passes 79 suites / 764 tests.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `rg -n "JSON\\.stringify\\(request\\.body\\)" src --glob '*.ts'` — no matches.
- `rg -n "attempts = attempts \\+ 1|getAttempts\\(" src/outbox --glob '*.ts'` — no matches.
- `npm run test:e2e -- billing.e2e-spec.ts --runInBand` — pass; 1 suite / 14 tests.
- `npm run test:e2e -- billing.e2e-spec.ts --runInBand --detectOpenHandles` — pass; 1 suite / 14 tests, no open handles reported.

Remaining:
- none for Phase 4.

## Phase 5 Result

Changed:
- `src/realtime/socket-auth-token.ts:11` — WebSocket auth token extraction now accepts `handshake.auth.token` or `Authorization: Bearer ...` only; query-string tokens are no longer accepted.
- `src/realtime/socket-auth-token.spec.ts:1` — unit tests cover auth-token precedence, Bearer header extraction, query-token rejection, and non-Bearer rejection.
- `test/realtime.e2e-spec.ts:12` — realtime e2e imports `JwtService` as a runtime provider so Nest can resolve the test gateway.
- `test/realtime.e2e-spec.ts:27` — realtime e2e uses the production WebSocket token helper.
- `test/realtime.e2e-spec.ts:102` — test gateway no longer accepts query-string tokens.
- `src/app.module.ts:41` — global throttler default is now 300 requests/minute instead of the audit-blocking 10 requests/minute.
- `src/bootstrap.ts:28` — Helmet now emits a minimal JSON-API CSP with `default-src 'none'` and `frame-ancestors 'none'`.
- `src/infra/logger/logger.module.ts:36` — shared request-ID resolution now honors inbound `x-request-id` and generates one when absent.
- `src/infra/logger/logger.module.ts:47` — Pino `genReqId` now uses the same request ID and writes it to the response header.
- `src/bootstrap.ts:68` — request-ID middleware now reuses `req.id` from Pino when present, ensuring response headers and error envelopes agree.
- `src/common/errors/api-exception.filter.ts:87` — exception filter now has a logger dependency.
- `src/common/errors/api-exception.filter.ts:115` — non-HttpException 500s are logged with stack trace and request ID before returning the public error envelope.
- `src/common/common.spec.ts:100` — regression test proves plain errors do not leak but do log stack/request ID.
- `src/infra/logger/logger.module.spec.ts:210` — request-ID resolver tests cover inbound and generated IDs.
- `test/app.e2e-spec.ts:262` — e2e test verifies CSP header.
- `test/app.e2e-spec.ts:272` — e2e test verifies inbound request ID echo.
- `Dockerfile:23` — production dependency pruning happens in a separate stage; runtime no longer runs a second `npm ci`.
- `Dockerfile:34` — runtime files are copied as the non-root `node` user.
- `Dockerfile:41` — image now declares a `/health/live` healthcheck.
- `.github/workflows/deploy.yml` — deleted per ADR-0003 because no real deploy target exists.
- `.github/workflows/security.yml:21` — npm audit now runs at moderate severity after `npm ci`.
- `.github/workflows/security.yml:34` — CodeQL JavaScript/TypeScript analysis is enabled.
- `.github/workflows/security.yml:43` — container scanning now builds the Docker image and runs Trivy via pinned container image digest `aquasec/trivy@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e`.
- `.github/dependabot.yml:1` — Dependabot now tracks npm, Docker, and GitHub Actions updates.
- `package-lock.json` — transitive `qs` is updated to `6.15.2`, resolving `GHSA-q8mj-m7cp-5q26` without adding an override.
- `src/instrumentation.config.ts:6` — OTel endpoint resolution now validates production presence and URL shape before SDK construction.
- `src/instrumentation.ts:55` — trace and metric exporters use the validated OTLP endpoint.
- `src/instrumentation.ts:83` — SDK startup is registered on `globalThis` for Nest-managed shutdown instead of owning SIGTERM with `process.exit(0)`.
- `src/infra/observability/otel-shutdown.service.ts:17` — Nest shutdown hook now shuts down the started OTel SDK without importing instrumentation side effects.
- `src/infra/infra.module.ts:50` — OTel shutdown provider is registered in `InfraModule`.
- `src/outbox/outbox.processor.ts:35` — outbox processor now uses a stable per-process lock owner ID.
- `src/outbox/outbox.processor.ts:132` — processor releases its own `PROCESSING` locks on Nest shutdown.
- `src/outbox/outbox.processor.spec.ts:317` — regression test verifies shutdown lock release.
- `src/*/*controller.ts` — DTOs used by `@Body()` and `@Query()` now use runtime imports instead of type-only imports so Nest's global `ValidationPipe` receives real metatypes.
- `src/search/dto/search.query.dto.ts:13` — search entity types are shared by normal search validation and reindex query validation.
- `src/search/search.controller.ts:105` — reindex `entityType` is validated through `SearchReindexQueryDto` instead of a compile-time-only string union.
- `src/notifications/dto/list-notifications-query.dto.ts:1` — notifications now has a route-specific pagination DTO that preserves the documented service clamp to 50 while still validating integer/minimum shape.
- `src/messaging/messaging.service.ts:192` — conversation and message pagination now default missing `limit` before passing `take` to Prisma, protecting real requests and direct service tests from `take: undefined`.
- `src/messaging/messaging.service.spec.ts:206` — regression tests cover missing-limit defaults for conversations and messages.
- `test/helpers/e2e-mocks.ts:1` — shared e2e mock helpers provide Redis lifecycle methods, outbox shutdown `updateMany`, and `RolesGuard` permission shape.
- `test/admin.e2e-spec.ts:20`, `test/analytics.e2e-spec.ts:181`, `test/moderation.e2e-spec.ts:21`, `test/search.e2e-spec.ts:128`, `test/auth.e2e-spec.ts:272`, `test/billing.e2e-spec.ts:15`, and `test/notifications.e2e-spec.ts:322` — e2e contracts now use valid UUID fixtures and restored validation expectations.
- `test/helpers/e2e-global-setup.ts:1` — CI/local e2e can now start Postgres, Redis, MinIO, Elasticsearch, and MailHog with Testcontainers when `MDC_E2E_TESTCONTAINERS=true`.
- `test/helpers/e2e-global-teardown.ts:1` — Testcontainers e2e teardown removes started infrastructure containers by recorded container ID.
- `test/jest-e2e.json:5` — e2e Jest config wires the Testcontainers global setup/teardown.
- `.github/workflows/ci.yml:13` — CI no longer uses GitHub service containers; e2e infra is delegated to Testcontainers per ADR-0008.
- `.github/workflows/ci.yml:51` — CI env now explicitly includes refresh-cookie defaults and `BILLING_WEBHOOK_SECRET`, matching validated test config and preventing the prior Actions env failure.
- `test/AGENTS.md:56` and `.github/workflows/AGENTS.md:21` — testing/workflow docs now describe the Testcontainers e2e path.

Verification:
- `npm test -- socket-auth-token.spec.ts --runInBand` — pass; 1 suite / 4 tests.
- `npm test -- common.spec.ts logger.module.spec.ts --runInBand` — pass; 2 suites / 32 tests.
- `npm test -- instrumentation.config.spec.ts otel-shutdown.service.spec.ts --runInBand` — pass; 2 suites / 6 tests.
- `npm test -- outbox.processor.spec.ts --runInBand` — pass; 1 suite / 20 tests.
- `npm test -- messaging.service.spec.ts search.controller.spec.ts --runInBand` — pass; 2 suites / 22 tests.
- `npm run test:e2e -- app.e2e-spec.ts --runInBand` — pass; 1 suite / 9 tests.
- `npm run test:e2e -- realtime.e2e-spec.ts --runInBand` — pass; 1 suite / 5 tests.
- `npm run test:e2e -- admin.e2e-spec.ts analytics.e2e-spec.ts moderation.e2e-spec.ts search.e2e-spec.ts --runInBand` — pass; 4 suites / 47 tests.
- `npm run test:e2e -- messaging.e2e-spec.ts --runInBand` — pass; 1 suite / 10 tests.
- `npm run test:e2e -- billing.e2e-spec.ts --runInBand --detectOpenHandles` — pass; 1 suite / 14 tests.
- `npm run test:e2e -- --runInBand` — pass; 21 suites / 183 tests passed / 25 skipped.
- `docker build -t mdc-be:test .` — pass.
- `docker image inspect mdc-be:test --format '{{.Config.User}} {{json .Config.Healthcheck}}'` — user is `node`; healthcheck is configured for `/health/live`.
- `docker image inspect mdc-be:test --format '{{.Config.Env}}'` — no baked `APP_PROCESS_ROLE`; only base image env plus `NODE_ENV=production`.
- `ruby -e "require 'yaml'; ..."` over `.github/workflows/ci.yml`, `.github/workflows/security.yml`, and `.github/dependabot.yml` — pass.
- `npm run test:e2e -- --runInBand` after Testcontainers setup wiring with flag unset — pass; 21 suites / 183 tests passed / 25 skipped.
- `npm audit --audit-level=moderate` — pass; found 0 vulnerabilities.
- `npm ls qs` — all resolved instances are `qs@6.15.2`.
- `rg -n "handshake\\.query\\.token" src --glob '*.ts'` — no matches.
- `rg -n "JSON\\.stringify\\(request\\.body\\)" src --glob '*.ts'` — no matches.
- `rg -n "process\\.env" src/auth --glob '*.ts'` — no matches.
- `rg -n "attempts = attempts \\+ 1|getAttempts\\(" src/outbox --glob '*.ts'` — no matches.
- `git diff --check` — pass.
- `npm run check` — pass; strict typecheck, lint with zero warnings, unit tests 79 suites / 764 tests.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `gh run list --repo MinhDuyDEV/mdc-be --workflow CI --limit 5` — latest remote CI runs are still failing; no green Actions proof exists for current uncommitted workflow changes.
- `gh run view 26338111786 --repo MinhDuyDEV/mdc-be --log-failed` — latest main CI failure came from missing `BILLING_WEBHOOK_SECRET` during unit tests on an older workflow revision.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml')"` — pass after adding explicit CI env.

Remaining:
- no in-repo Phase 5 work remains.
- Remote GitHub Actions proof still requires commit/push or another approved workflow-run path; current local workflow YAML parses and local verification is green, but no remote run exists for these uncommitted changes.

## Phase 6 Result

Changed:
- `src/outbox/dead-letter.service.ts:43` — dead-letter replay now supports caller transactions, validates payloads against the event-schema registry, creates a new `PENDING` outbox row, and removes the dead-letter row.
- `src/admin/dto/admin-query.dto.ts:38` — added dead-letter list query DTO with `eventType` and cursor validation.
- `src/admin/admin.controller.ts:72` — added `GET /admin/outbox/dead-letter` guarded by admin role plus `MANAGE_ADMINS`.
- `src/admin/admin.controller.ts:78` — added `POST /admin/outbox/dead-letter/:id/replay` guarded by admin role plus `MANAGE_ADMINS`.
- `src/admin/admin.service.ts:132` — admin dead-letter listing returns 50-row pages with `hasNextPage` and `endCursor`.
- `src/admin/admin.service.ts:151` — replay and audit log write now happen in one transaction under `admin.outbox.dead_letter.replay`.
- `src/admin/admin.module.ts:4` — admin module imports `OutboxCoreModule` for `DeadLetterService`.
- `docs/runbooks/outbox-replay.md:1` — added operator runbook for inspect/replay flow and verification checks.
- `src/admin/admin.service.spec.ts:55` — tests cover dead-letter list pagination and transactional replay audit.
- `src/outbox/dead-letter.service.spec.ts:48` — tests cover standalone replay and caller-transaction replay with registered event payloads.
- `src/outbox/outbox.processor.ts:23` — claimed events now carry aggregate identity so dispatch can group by aggregate.
- `src/outbox/outbox.processor.ts:30` — outbox dispatch uses a bounded in-process concurrency cap of 4.
- `src/outbox/outbox.processor.ts:98` — claimed batches are grouped by aggregate and processed through the bounded worker loop instead of one global serial loop.
- `src/outbox/outbox.processor.ts:189` — each aggregate group remains sequential while independent groups can process concurrently.
- `src/outbox/outbox.processor.spec.ts:223` — regression test proves an independent fast aggregate can finish while another aggregate handler is still blocked.
- `src/outbox/events/event-schema.registry.ts:1` — added per-event-type Zod payload schemas plus runtime validation helpers for emit and dispatch paths.
- `src/outbox/outbox.service.ts:6` — outbox event inputs now use known event types and validate payloads before inserting `PENDING` rows.
- `src/outbox/outbox.processor.ts:224` — dispatcher validates stored event payloads before routing handlers, so malformed rows fail and retry/dead-letter instead of silently running casts.
- `src/companies/companies.service.ts:619` — `RecruiterSeatAllocated` payload now includes `recruiterUserId`, matching the dispatcher/notification contract while preserving existing `userId`.
- `src/outbox/outbox.service.spec.ts:26` — outbox service tests now use registered event types and cover malformed-payload rejection before insert.
- `src/outbox/outbox.processor.spec.ts:485` — processor tests cover dispatch-time payload rejection before handler calls.
- `src/infra/scheduling/leader-lock.service.ts:7` — added Redis-backed leader locks using `SET key token PX ttl NX` plus token-checked Lua release.
- `src/infra/infra.module.ts:51` — `LeaderLockService` is registered and exported from `InfraModule`.
- `src/outbox/idempotency.service.ts:67` — hourly idempotency cleanup now runs only while holding the `idempotency-cleanup` leader lock.
- `src/media/media-cleanup.service.ts:19` — media cleanup now runs only while holding the `media-cleanup` leader lock.
- `src/infra/scheduling/leader-lock.service.spec.ts:1` — tests cover acquire, skip, and release-on-error behavior.
- `src/outbox/idempotency.service.spec.ts:94` — tests cover locked idempotency cleanup and skipped cleanup when another worker holds the lock.
- `src/media/media-cleanup.service.spec.ts:1` — tests cover locked media cleanup and skipped cleanup when another worker holds the lock.
- `src/outbox/outbox.metrics.ts:10` — added an injectable OTel metrics wrapper for processed, failed, dead-lettered, dispatch-duration, and pending-count outbox metrics.
- `src/outbox/outbox.processor.ts:63` — outbox processor now receives `OutboxMetrics` and registers an observable pending-events gauge backed by `outboxEvent.count`.
- `src/outbox/outbox.processor.ts:101` — successful dispatch records `outbox.dispatch.duration_ms` and successful processing increments `outbox.events.processed`.
- `src/outbox/outbox.processor.ts:117` — failed processing increments `outbox.events.failed` and dispatch failures record failed dispatch duration.
- `src/outbox/outbox.processor.ts:136` — dead-letter transitions increment `outbox.events.dead_lettered`.
- `src/outbox/outbox-processor.module.ts:23` — processor module registers `OutboxMetrics` for worker runtime injection.
- `src/outbox/outbox.processor.spec.ts:124` — regression tests cover pending gauge callback, success metrics, failure metrics, dead-letter metrics, and shutdown unregister.
- `.env.example:10` — documented role-specific `connection_limit` guidance for deployment `DATABASE_URL` values and added Prisma transaction timeout defaults.
- `src/infra/config/app-config.ts:9` — typed Prisma transaction timeout settings are now part of validated app config.
- `src/infra/config/validate-env.ts:130` — `PRISMA_TRANSACTION_MAX_WAIT_MS` and `PRISMA_TRANSACTION_TIMEOUT_MS` are validated as optional positive integers.
- `src/infra/prisma/prisma.service.ts:18` — Prisma transactions now default to `maxWait=5000ms` and `timeout=15000ms`, overridable from config.
- `src/infra/prisma/prisma.service.ts:48` — PrismaClient receives transaction defaults at construction so direct `$transaction` calls inherit them.
- `src/infra/prisma/prisma.service.ts:78` — `withTransaction` passes the same timeout defaults explicitly.
- `src/infra/config/validate-env.spec.ts:179` — regression tests cover Prisma transaction timeout parsing and invalid values.
- `src/infra/prisma/prisma.service.spec.ts:40` — regression tests cover default and configured transaction options.
- `src/companies/companies.service.ts:68` — added a single bounded P2002-aware slug retry helper with a 10-attempt cap and no pre-write `count`.
- `src/companies/companies.service.ts:157` — company creation now uses the shared helper for slug writes.
- `src/companies/companies.service.ts:323` — company rename now uses the shared helper, so slug collisions retry with numeric suffixes instead of using the deleted count-only `generateUniqueSlug`.
- `src/companies/companies.service.spec.ts:126` — regression test covers create-side P2002 retry and proves `company.count` is no longer used for slug preflight.
- `src/companies/companies.service.spec.ts:177` — regression test covers update-side P2002 retry on rename.
- `prisma/schema.prisma` — removed denormalized `Company.followerCount`; entity relationship counts now use Prisma `_count` per ADR-0005.
- `prisma/migrations/20260524093000_refresh_media_visibility_counts/migration.sql` — drops `companies.follower_count`.
- `src/companies/companies.service.ts` — company responses derive `followerCount` and `memberCount` from `_count`; follow/unfollow no longer mutate a denormalized counter.
- `src/outbox/processors/company-search-index.processor.ts`, `src/search/search-index.service.ts`, and `src/recommendations/recommendations.service.ts` — relationship count projections now use `_count` instead of stale denormalized fields.
- `src/companies/companies.service.spec.ts`, `src/recommendations/recommendations.service.spec.ts`, `src/outbox/processors/company-search-index.processor.spec.ts`, and `src/search/search-index.service.spec.ts` — counter-strategy regression coverage updated.

Verification:
- `npm test -- admin.service.spec.ts dead-letter.service.spec.ts --runInBand` — pass; 2 suites / 8 tests.
- `npm run test:e2e -- admin.e2e-spec.ts --runInBand` — pass; 1 suite / 13 tests. Jest still printed the existing open-handle warning after completion.
- `npm test -- outbox.processor.spec.ts --runInBand` — pass; 1 suite / 23 tests.
- `npm test -- outbox.service.spec.ts outbox.processor.spec.ts companies.service.spec.ts --runInBand` — pass; 3 suites / 37 tests.
- `npm test -- leader-lock.service.spec.ts idempotency.service.spec.ts media-cleanup.service.spec.ts --runInBand` — pass; 3 suites / 12 tests.
- `npm test -- outbox.processor.spec.ts --runInBand` — pass; 1 suite / 21 tests.
- `npm test -- prisma.service.spec.ts validate-env.spec.ts --runInBand` — pass; 2 suites / 33 tests.
- `npm test -- companies.service.spec.ts --runInBand` — pass; 1 suite / 10 tests.
- `srcwalk find 'generateUniqueSlug, createCompanyWithUniqueSlug, withUniqueCompanySlug' --scope src/companies --scope test` — no `generateUniqueSlug` matches; shared helper used by create and update paths.
- `npm run typecheck` — pass.
- `npm run check` — pass; strict typecheck, lint with zero warnings, unit tests 81 suites / 782 tests.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `git diff --check` — pass.
- `npm test -- companies.service.spec.ts recommendations.service.spec.ts company-search-index.processor.spec.ts search-index.service.spec.ts --runInBand` — pass.

Remaining:
- none for Phase 6.

## Phase 7 Result

Changed:
- `README.md:1` — replaced default Nest starter README with project-specific onboarding, runtime-role notes, verification commands, and links to architecture/runbooks.
- `package.json:4` — populated package description and author while keeping private `UNLICENSED` status documented in README pending an ownership license decision.
- `prisma/schema.prisma:1` — added single-file region comments per ADR-0007 without changing schema shape or migrations.
- `eslint.config.mjs:7` — added domain module inventory, current production allowlist, and `no-restricted-imports` boundary configs that fail new unapproved cross-domain imports.
- `src/infra/logger/logger.module.ts:29` — added depth-2 request-body redaction paths for wrapped application/recruiting payloads.
- `src/infra/logger/logger.module.spec.ts:179` — added regression tests for `screeningAnswers[*].answer` and nested recruiting/application PII fields.
- `src/common/idempotency/idempotent-request.decorator.ts:3` — added opt-in metadata for request-header idempotency scopes.
- `src/common/idempotency/idempotency-key.interceptor.ts:35` — added generic `Idempotency-Key` interceptor with body hash validation, stored-response replay, in-progress conflict handling, and claim cleanup on handler error.
- `src/common/common.module.ts:9` — registered and exported the idempotency interceptor for module-level use.
- `src/companies/companies.module.ts:10` — imported `CommonModule` so the company create demo can resolve the interceptor through DI.
- `src/companies/companies.controller.ts:38` — opted `POST /companies` into `Idempotency-Key` replay behavior.
- `src/common/idempotency/idempotency-key.interceptor.spec.ts:81` — covered claim, replay, mismatch, missing header, missing decorator, and handler-failure cleanup behavior.
- `test/companies.e2e-spec.ts:500` — added e2e replay proof for repeated `Idempotency-Key` on company creation.
- `.beads/issues.jsonl` — created audit TODO beads `mdc-be-x3g`, `mdc-be-n0v`, `mdc-be-dwe`, `mdc-be-qdx`, and `mdc-be-yha` without closing or syncing them.
- `src/analytics/dto/analytics-response.dto.ts`, `src/outbox/processors/profile-creation.processor.ts`, and `src/recommendations/recommendations.service.ts` — production TODO comments now include Beads IDs.

Verification:
- `npm test -- idempotency-key.interceptor.spec.ts logger.module.spec.ts --runInBand` — pass; 2 suites / 31 tests.
- `npm run test:e2e -- companies.e2e-spec.ts --runInBand` — pass; 1 suite / 12 tests.
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npx prisma validate` — pass.
- `npm run check` — pass; strict typecheck, lint with zero warnings, unit tests 82 suites / 790 tests.
- `npm run build` — pass.
- `npm run test:e2e -- --runInBand` — pass; 21 suites / 184 tests passed / 25 skipped.
- `git diff --check` — pass.
- `br list --label audit-todo --json` — five open TODO beads exist.
- `rg -n "TODO(?!\\()" src --glob '*.ts' -P` — no untracked production TODOs.

Remaining:
- no in-repo Phase 7 work remains.
- Beads TODOs remain open by design; user approved create/update only, not close or sync.
- License remains `UNLICENSED`; changing it is an ownership/legal decision outside code cleanup.

## Current Completion Audit — 2026-05-24

Completed or documented:
- Phase 0 — ADRs, baseline, and Beads planning artifacts exist; Beads sync/closure remains unapproved.
- Phase 1 — type safety, strict lint, `check`, Jest env defaults, and production `tx as any` removal are complete.
- Phase 2 — cookie config, optional-auth policy, opaque refresh-token rotation, token-ID lookup, family-scoped replay revocation, cookie-only refresh, and legacy dual-read are complete.
- Phase 3 — persisted media visibility, conservative backfill, public anonymous reads, private owner-only reads, and connections-only authorization are complete.
- Phase 4 — webhook raw-body hard fail, envelope bypass, transaction-scoped idempotency, and outbox attempts semantics are complete.
- Phase 5 — Docker hardening, request IDs, 500 logging, throttling, WebSocket query-token removal, OTel shutdown, outbox shutdown release, CSP, CodeQL, pinned-digest Trivy container scanning, Dependabot, `qs@6.15.2`, and Testcontainers CI wiring are complete in repo.
- Phase 6 — event schema registry, bounded outbox dispatch, metrics, leader locks, DLQ admin/runbook, Prisma timeout config, slug helper consolidation, and `_count` entity counter strategy are complete.
- Phase 7 — README, schema regions, boundary linting, `Idempotency-Key` opt-in interceptor, redaction depth tests, package metadata, and TODO ticketization are complete.

Fresh verification:
- `npx prisma generate` — pass.
- `npx prisma validate` — pass.
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm test` — pass; 82 suites / 798 tests.
- `npm run build` — pass.
- `npm run test:e2e -- --runInBand` — pass; 21 suites / 185 tests passed / 25 skipped.
- `npm audit --audit-level=moderate` — pass; found 0 vulnerabilities.
- `docker build -t mdc-be:test .` — pass.
- `docker image inspect mdc-be:test --format '{{.Config.User}} {{json .Config.Healthcheck}}'` — user is `node`; `/health/live` healthcheck configured.
- `ruby -e "require 'yaml'; %w[.github/workflows/ci.yml .github/workflows/security.yml .github/dependabot.yml].each { |p| YAML.load_file(p); puts %(ok #{p}) }"` — pass.
- `git diff --check` — pass.
- `rg -n "tx as any" src --glob '*.ts' --glob '!*.spec.ts'` — no production matches.
- `rg -n "@ts-ignore|eslint-disable| as any" src --glob '*.ts' --glob '!*.spec.ts'` — no production matches.
- `rg -n "process\\.env" src/auth --glob '*.ts'` — no matches.
- `rg -n "handshake\\.query\\.token" src --glob '*.ts'` — no matches.
- `rg -n "JSON\\.stringify\\(request\\.body\\)" src --glob '*.ts'` — no matches.
- `rg -n "TODO(?!\\()" src --glob '*.ts' -P` — no untracked production TODOs.

Known blockers:
- Remote GitHub Actions proof still requires commit/push or another approved workflow-run path; no remote CI/security run exists for these uncommitted changes.
- Commit, push, Beads close/sync, and production migration application remain unapproved.
- License remains `UNLICENSED`; changing it is an ownership/legal decision outside audit cleanup.

---

## Final Result

Completed:
- Phase 0 — baseline, ADRs, and Beads planning artifacts.
- Phase 1 — strict type/lint safety and local test reliability.
- Phase 2 — refresh-token security rewrite.
- Phase 3 — media authorization model.
- Phase 4 — webhook/idempotency/outbox correctness.
- Phase 5 — runtime, observability, Docker, CI wiring, audit, Trivy, and security guardrails.
- Phase 6 — outbox scalability, operational tooling, and `_count` counter strategy.
- Phase 7 — documentation, maintainability, boundary linting, idempotency header support, and TODO ticketization.

Verification:
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: pass; 82 suites / 798 tests.
- `npm run build`: pass.
- `npx prisma generate`: pass.
- `npx prisma validate`: pass.
- `npm audit --audit-level=moderate`: pass.
- `npm run test:e2e -- --runInBand`: pass; 21 suites / 185 tests passed / 25 skipped.
- `docker build -t mdc-be:test .`: pass.
- YAML workflow parse, Docker image inspect, invariant scans, and `git diff --check`: pass.

Known blockers:
- Remote GitHub Actions proof is unavailable until commit/push or an approved workflow-run path.
- Beads sync/close and git commit/push require separate approval.
- Production database migration/backfill application is not performed in this local audit run.

Next recommended action:
- Review the diff, then approve a local commit. After that, push and let GitHub Actions produce remote CI/security proof.

# Final Recommendation

## Can the project ship as-is?

**Code is locally ready for review and PR.** Public-traffic readiness still requires production migration/backfill execution and a green remote CI/security run after push.

## First three things to do next (in this order)

1. **Approve local commit** after reviewing the dirty worktree.
2. **Push and wait for GitHub Actions** to prove CI/security remotely on the exact committed workflow changes.
3. **Apply database migration/backfill in the target environment** before enabling public traffic.

All prior P0/P1 audit blockers are addressed in code.

---

*Audit performed on commit at HEAD on 2026-05-23. Audit/optimization implementation completed locally on 2026-05-24. Re-audit recommended after remote CI/security proof and production migration application.*
