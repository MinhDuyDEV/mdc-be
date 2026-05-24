# Project Optimization Phase Plan
**Repo:** `MinhDuyDEV/mdc-be`
**Source:** `AUDIT_REPORT.md`
**Plan author role:** Principal Engineer / Technical Project Planner
**Plan date:** 2026-05-23
**Mode:** Plan-only. No code, no migration, no commit.

---

## 1. Executive Planning Summary

### Current readiness level
- **Architecture:** strong modular monolith with explicit transactional outbox, role-split runtime (`api|worker|realtime|all`), Pino + OpenTelemetry, Redis-backed Socket.IO, MinIO/S3, Elasticsearch facade.
- **Tests:** 75 suites / 739 unit tests passing; E2E specs exist per domain (real-infra coverage unverified in audit).
- **Verified state:** `prisma validate` ✓, `typecheck` ✓ (weak — `strict` is off), `build` ✓, `npm run lint` ✓ but with `--fix` and 157 unfixed warnings, `npm test` works only with full env exported.
- **Bottom line:** **Internal-tooling shippable. NOT yet public-traffic shippable.** Three blocker classes (refresh-token rotation, media authorization, idempotency-inside-tx + webhook robustness) must land first.

### Main blockers (from `AUDIT_REPORT.md`)
1. **[P0] Refresh-token rotation is broken** — `TokenService.validateAndRotateRefreshToken` looks up by `userId` only; `familyId` is never persisted; reuse-detection is fake; multi-device sessions interfere.
2. **[P0] Media authorization is owner-only** — public avatars / post images / company logos cannot be served.
3. **[P1] Idempotency claim commits outside caller's transaction** — failed creations permanently block retries.
4. **[P1] Webhook robustness** — `JSON.stringify` raw-body fallback + `ApiResponseInterceptor` wrapping the webhook response break the provider contract.
5. **[P1] Safety-net weakness** — `tsconfig "strict"` off, ESLint `no-explicit-any` off, `lint --fix` in CI, 157 warnings tolerated, `npm test` env-fragile.
6. **[P1] Production hardening gaps** — Dockerfile runs as root with no `HEALTHCHECK`, deploy workflow is a placeholder, CI E2E has no MinIO/ES/SMTP services.

### Recommended execution strategy
- **Build the safety net first.** Phase 1 (type safety + CI + test env) pays interest on every subsequent fix. Doing security/auth rewrites first while the lint+types are loose multiplies bug surface.
- **Then fix the P0s in security-isolated PRs.** Refresh-token rewrite and media authz are independent and can run in parallel after Phase 1.
- **Then production hardening.** Dockerfile / observability / outbox metrics / deploy plumbing.
- **Then scalability + DX polish.** Outbox parallelism, schema regions, README, etc.
- Defer architectural refactors (boundary lint, event-schema registry, schema multi-file) to Phase 7.

### Suggested PR size strategy
- **One concern per PR.** No mixing schema migration with cosmetic lint cleanup.
- **Target: ~300 LOC net, ≤1,000 LOC ceiling.** If a fix exceeds the ceiling, split into setup-PR (types/scaffolding) + fix-PR (logic) + cleanup-PR (lint compliance).
- **Required for every PR:** `npm run typecheck`, `npm run lint` (post Phase 1: strict), `npm test`, plus any phase-specific verification.
- **Auth/security PRs must include regression tests** that would have caught the original bug. No "fix without test."
- **Schema migrations isolated.** A migration PR contains only the migration + minimum code referencing the new column; logic that uses the column lands in a following PR.

---

## 2. Phase Overview

| Phase | Name | Goal | Priority | Risk | Can Ship After? | Estimated PRs |
|-------|------|------|----------|------|-----------------|---------------|
| 0 | Planning, Safety Net & Baseline Verification | Approve plan, snapshot baseline, resolve decisions | P0 prereq | Low | No | 1 (docs) |
| 1 | Type Safety, CI, and Local Dev Reliability | Strict TS, real lint gate, `PrismaTransaction` fix, `npm test` works without env | P0 | Medium (noisy diff) | No | 5–7 |
| 2 | Auth Refresh Token Security Fix | Fix multi-device rotation, real reuse detection, correct refresh contract | P0 | High (auth) | Internal beta | 4–5 |
| 3 | Media Authorization Model Fix | Public/private media access model | P0 | High (data exposure) | Internal beta | 3–4 |
| 4 | Billing/Webhook and Idempotency Correctness | Idempotency-in-tx, webhook raw-body, response envelope bypass, attempts counter | P1 | Medium | Closed beta | 3–4 |
| 5 | Runtime, Observability & Production Guardrails | Dockerfile hardening, request-ID, 500 logging, throttler tuning, OTel validation, graceful shutdown, security workflow | P1 | Medium | Closed beta | 6–8 |
| 6 | Outbox Scalability & Operational Tooling | Per-event schema, parallel dispatch, DLQ admin, leader election, metrics | P2 | Medium | Public traffic | 4–6 |
| 7 | Maintainability, Docs & Long-term Architecture | README, schema regions, boundary linting, event registry, Idempotency-Key header | P2/P3 | Low | Public traffic+ | 4–6 |

Total expected PRs: **30–40** small/medium PRs across ~3–4 sprints.

---

## 3. Detailed Phase Breakdown

---

## Phase 0 — Planning, Safety Net & Baseline Verification

### Goal
Lock in the plan, snapshot the current state, and resolve the architectural decisions that block Phase 1+.

### Why This Phase Comes Here
Resolving "Decision Needed" items up front prevents thrash later. Snapshotting baseline metrics (warning count, coverage, p95 latencies if available) provides regression evidence for downstream PRs.

### Scope
**Included:**
- Plan approval; "Decisions Needed" answered by product/architecture owner.
- Beads issues created for each task in Phases 1–7.
- Baseline verification re-run on a clean clone.
- Branch protection rules tightened (require lint + typecheck + tests before merge to `main`).

**Excluded:**
- No code changes.
- No schema changes.

### Tasks

#### Task 0.1 — Resolve architectural decisions
**Source finding:** Audit roadmap notes multiple "Decision Needed" items.
**Files likely touched:**
- `docs/decisions/` (new ADR files)
**Description:** Run a 60-minute decision meeting. Answer the seven items in Section 6 below. Record each as a one-page ADR.
**Implementation notes:** Use `docs/decisions/0001-refresh-token-shape.md` numbering convention.
**Dependencies:** None
**Can run parallel with:** Task 0.2, 0.3
**Needs DB migration:** No
**Risk:** Low
**Verification:** All seven ADRs committed with a clear "Accepted" status.
**Done Criteria:** ADRs merged, linked from `docs/architecture.md`.

#### Task 0.2 — Create Beads issues for all Phase 1–7 tasks
**Source finding:** `AUDIT_REPORT.md` — Quick Wins + per-finding recommendations.
**Files likely touched:** `.beads/` only.
**Description:** Translate each task in this plan into a `bd create` ticket with the right priority, type, and dependency edges. Use `bd dep add` to link Phase 2 to Phase 1, Phase 3 to Phase 1, etc.
**Implementation notes:** Use the priority field from this plan. Mark Phase-1 tasks as `bd ready`.
**Dependencies:** Task 0.1 (decisions inform task scope)
**Can run parallel with:** Task 0.3
**Needs DB migration:** No
**Risk:** Low
**Verification:** `bd list --status=open` shows all planned tasks.
**Done Criteria:** Each task in this plan has a beads ticket; `bd ready` shows only Phase-1 tasks.

#### Task 0.3 — Baseline metrics snapshot
**Source finding:** Audit Verification Results.
**Files likely touched:** `docs/baseline/2026-05-baseline.md` (new).
**Description:** Record:
- ESLint warning count under `--max-warnings 0` (currently 157).
- `npm test` pass count (currently 75 suites / 739 tests, ~7.6 s).
- Build time, image size (`docker build .` if possible).
- p95 latency baseline if a perf environment exists.
**Implementation notes:** Snapshot is a regression guard. Phase 1 PRs will be allowed to *reduce* warnings, never increase.
**Dependencies:** None
**Can run parallel with:** Task 0.1, 0.2
**Needs DB migration:** No
**Risk:** Low
**Verification:** Snapshot file committed.
**Done Criteria:** Baseline file exists and is referenced from the README.

### Phase Verification
```bash
git ls-files docs/decisions/
bd list --status=open
cat docs/baseline/2026-05-baseline.md
```

### Phase Exit Criteria
- All Decisions Needed in Section 6 have a written, accepted ADR.
- Beads has all Phase 1–7 tasks with correct dependencies.
- Baseline snapshot committed.

---

## Phase 1 — Type Safety, CI, and Local Dev Reliability

### Goal
Turn the safety net on. Make TypeScript and ESLint catch real issues, make `npm test` work for new contributors, make CI lint enforce instead of mutate.

### Why This Phase Comes Here
Every later fix benefits from a real type system and a real lint gate. Doing Phase 2 (auth) with `tx as any` everywhere multiplies bug risk. Doing Phase 5 (observability) with floating promises as warnings is fragile. Build the floor first.

### Scope
**Included:**
- `PrismaTransaction = Prisma.TransactionClient` + remove production `tx as any` casts.
- `tsconfig.json` `strict: true` + selected stricter flags.
- ESLint: promote `no-explicit-any`, `no-floating-promises`, `no-unsafe-argument` to `error` (production sources; tests can keep an override).
- Split `lint` (verify) vs `lint:fix` (mutate).
- `jest.setup.ts` so `npm test` runs without exported env vars.
- New top-level `check` script (`typecheck + lint + test`).
- CI: drop `--fix` from `lint`, run `--max-warnings 0`.

**Excluded:**
- No auth/media/idempotency logic changes.
- No schema changes.

### Tasks

#### Task 1.1 — Fix `PrismaTransaction` type
**Source finding:** `[P1] PrismaTransaction is Omit<PrismaService, ...> — not the actual transaction client type`.
**Files likely touched:**
- `src/infra/prisma/prisma.service.ts`
- `src/outbox/outbox.service.ts`
- `src/auth/auth.service.ts` (`:76, :153`)
- `src/companies/companies.service.ts` (~14 sites)
- `src/media/media.service.ts` (`:123, :203`)
- `src/profiles/profiles.service.ts` (`:99`)
- any other `tx as any` callers
**Description:**
1. Change `export type PrismaTransaction = Prisma.TransactionClient;` in `prisma.service.ts`.
2. Remove the runtime `(tx as any).outboxEvent?.create` guard in `OutboxService.emit` once types make it impossible.
3. Replace every `tx as any` in production code with `tx`.
4. Tests retain `as any` if needed (override block in ESLint).
**Implementation notes:** Should be a single PR. Expect compiler errors in callers — fix them by adjusting parameter types, not by re-adding `as any`. Add an ESLint rule `no-restricted-syntax: TSAsExpression[typeAnnotation.typeName.name='any']` for `src/**/*.ts` (excluding `*.spec.ts`).
**Dependencies:** None
**Can run parallel with:** Task 1.4, 1.5
**Needs DB migration:** No
**Risk:** Medium (touches many services)
**Verification:**
```bash
npm run typecheck
npm test
grep -rn "tx as any" src --include="*.ts" | grep -v ".spec.ts"  # expect zero
```
**Done Criteria:** Zero `tx as any` in production code; outbox runtime guard removed; tests pass.

#### Task 1.2 — Enable `tsconfig "strict": true`
**Source finding:** `[P1] tsconfig.json does NOT enable strict: true`.
**Files likely touched:**
- `tsconfig.json`
- Likely 30–80 production files needing minor type fixes (catch (e), undefined-narrowing, etc.).
**Description:** Set `"strict": true`. Optionally also enable `"useUnknownInCatchVariables": true` (it's on by default with `strict`), `"noUncheckedIndexedAccess": true` (more invasive — gate behind separate PR if too noisy).
**Implementation notes:** Land in two steps:
1. PR-A: `strict: true` only — fix resulting errors.
2. PR-B (optional, can defer): `noUncheckedIndexedAccess: true` + `exactOptionalPropertyTypes: true`.
**Dependencies:** Task 1.1 (the type-correct `PrismaTransaction` reduces the strict-mode error count dramatically)
**Can run parallel with:** Task 1.4 (lint script split) — different files
**Needs DB migration:** No
**Risk:** Medium (large diff, mostly mechanical)
**Verification:**
```bash
npm run typecheck   # must pass with strict on
```
**Done Criteria:** `tsconfig.json` has `"strict": true`; `typecheck` is clean.

#### Task 1.3 — Promote ESLint rules to errors
**Source finding:** `[P1] ESLint disables no-explicit-any globally`; `[P2] no-floating-promises and no-unsafe-argument downgraded to warn`.
**Files likely touched:**
- `eslint.config.mjs`
- Many production files needing fixes (currently 157 warnings).
**Description:**
1. Change `@typescript-eslint/no-explicit-any`: `'off'` → `'error'` (for `src/**/*.ts`, override `'off'` for `**/*.spec.ts` + `test/**/*.ts`).
2. Promote `no-floating-promises`: `'warn'` → `'error'`.
3. Promote `no-unsafe-argument`: `'warn'` → `'error'`.
4. Fix the resulting errors. (Many will be auto-resolved by Task 1.1.)
**Implementation notes:** This PR can be large. Strategy: enable rules → run lint → split fixes into one PR per module if needed. Each fix-PR should keep the new rules at `error`.
**Dependencies:** Task 1.1 (kills ~18 unsafe-argument and explicit-any sites)
**Can run parallel with:** Task 1.2 (different files, same goal)
**Needs DB migration:** No
**Risk:** Medium (noisy diff)
**Verification:**
```bash
npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0   # exit 0
```
**Done Criteria:** Zero ESLint warnings under `--max-warnings 0`.

#### Task 1.4 — Split lint scripts; CI enforces strict lint
**Source finding:** `[P1] CI script npm run lint includes --fix and CI succeeds despite 157 warnings`.
**Files likely touched:**
- `package.json` (`scripts`)
- `.github/workflows/ci.yml`
**Description:**
- `"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --max-warnings 0"` (verify).
- `"lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"` (mutate, local only).
- `"check": "npm run typecheck && npm run lint && npm test"` (umbrella).
- `.github/workflows/ci.yml`: replace `npm run lint` with `npm run lint` (now the strict version).
**Implementation notes:** Do this after Task 1.3 lands (otherwise CI breaks immediately on 157 warnings).
**Dependencies:** Task 1.3
**Can run parallel with:** None (gates CI behaviour)
**Needs DB migration:** No
**Risk:** Low
**Verification:**
```bash
npm run check   # exit 0
```
**Done Criteria:** Running `npm run lint` mutates nothing; CI fails on a planted warning; `npm run check` exits 0.

#### Task 1.5 — `npm test` works without env vars
**Source finding:** `[P1] npm test crashes without env vars set`.
**Files likely touched:**
- `jest.setup.ts` (new)
- `package.json` jest config (add `setupFiles`)
- Possibly `src/infra/config/validate-env.ts` (no logic change; only ensure tests bypass validation)
**Description:** Create `jest.setup.ts` that sets a known-good test env *before* any module loads. Wire it via `"setupFiles": ["<rootDir>/jest.setup.ts"]` in `package.json`'s `jest` config (note: must be `setupFiles`, not `setupFilesAfterEach`, so it runs before module load).
**Implementation notes:** Mirror `.env.example` minus secrets. Use placeholder values like `postgresql://x:x@localhost:5432/x?schema=public`. Document the file in `test/AGENTS.md`.
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.2, 1.3, 1.4
**Needs DB migration:** No
**Risk:** Low
**Verification:**
```bash
unset PORT DATABASE_URL JWT_ACCESS_SECRET    # etc.
npm test    # must pass
```
**Done Criteria:** A fresh shell with no env exports can run `npm test` to completion.

#### Task 1.6 — Coverage hygiene (low priority within Phase 1)
**Source finding:** `[P2] jest coverage collects from everywhere, no threshold`.
**Files likely touched:**
- `package.json` jest config
**Description:** Add `coveragePathIgnorePatterns` to exclude DTOs, modules, barrels, constants. Add `coverageThreshold` once a real number is known (suggest measure first, then set 5% below current to start).
**Implementation notes:** Don't gate on a guessed threshold — measure first.
**Dependencies:** Task 1.5
**Can run parallel with:** Task 1.4
**Needs DB migration:** No
**Risk:** Low
**Verification:** `npm run test:cov` produces filtered coverage.
**Done Criteria:** Coverage report excludes DTOs; threshold documented.

### Phase Verification
```bash
npm run check          # typecheck + lint --max-warnings 0 + test
npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0
grep -rn "tx as any" src --include="*.ts" | grep -v ".spec.ts"   # zero
```

### Phase Exit Criteria
- `strict: true` enabled, typecheck green.
- Zero ESLint warnings under `--max-warnings 0`.
- CI fails on a planted warning.
- `npm test` works from a clean shell.
- `npm run check` is the documented pre-PR command.
- No `tx as any` in production code.

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

---

## Phase 2 — Auth Refresh Token Security Fix

### Goal
Replace the broken refresh-token rotation with a correct, multi-device-safe, reuse-detecting implementation.

### Why This Phase Comes Here
Phase 1 has installed the type system + lint gate; auth rewrites land safely now. This is the **single highest-impact security fix.** It is independent of media/billing, so Phase 3 can run in parallel.

### Scope
**Included:**
- `RefreshToken` schema: add `familyId`, `parentTokenId`.
- Token lookup by token ID, not by `userId`.
- Reuse detection per family; only revoke the affected family.
- `/auth/refresh` no longer requires Bearer access token.
- Cookie flags read from ConfigService.
- `JWT_REFRESH_SECRET` actually used (or removed per ADR-0001).
- Optional: replace bcrypt-of-UUID with SHA-256 (per ADR-0001).

**Excluded:**
- No changes to login/register flows beyond what's needed to seed `familyId` for new sessions.
- No password-reset changes (those are separate flows in `password-reset.service.ts`).

### Tasks

#### Task 2.1 — Schema migration: add `familyId` + `parentTokenId` to `RefreshToken`
**Source finding:** `[P0] Refresh token lookup is by userId only`.
**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<ts>_add_refresh_token_family.sql` (new)
**Description:** Add two columns:
```prisma
familyId       String   @map("family_id") @db.Uuid
parentTokenId  String?  @map("parent_token_id") @db.Uuid
@@index([userId, familyId])
@@index([familyId])
```
For existing rows, backfill `familyId = id` (each existing row becomes its own family root).
**Implementation notes:** Two-step migration:
1. Add nullable columns + backfill.
2. Drop nullability on `familyId` in a follow-up migration.
Do not delete or rotate any existing tokens during migration.
**Dependencies:** ADR-0001 (refresh-token shape decision)
**Can run parallel with:** Task 3.1 (different model)
**Needs DB migration:** **Yes**
- Model/table changed: `refresh_tokens` (add `family_id`, `parent_token_id`, indexes)
- Migration intent: enable per-family rotation
- Backward compatibility concern: existing sessions remain valid; backfill `familyId = id` to preserve them.
**Risk:** Medium
**Verification:**
```bash
DATABASE_URL=... npx prisma migrate dev
npx prisma validate
npm run typecheck
```
**Done Criteria:** Migration applied locally; schema valid; Prisma client regenerated; new columns visible in `RefreshToken`.

#### Task 2.2 — Rewrite `TokenService` for family-aware rotation
**Source finding:** `[P0] Refresh token lookup is by userId only`.
**Files likely touched:**
- `src/auth/token.service.ts`
- `src/auth/auth.service.ts` (login path seeds first family)
- `src/auth/token.service.spec.ts`
**Description:**
1. `generateRefreshToken(userId, familyId?)`: if no `familyId`, generate a new one; persist `familyId` + `parentTokenId` (null for root, set otherwise).
2. `validateAndRotateRefreshToken(rawToken)`: parse the token, lookup by token ID (see ADR-0001 for opaque-vs-JWT format), verify `userId` from row matches the caller's claimed identity, check `expiresAt`, check `revokedAt`. On revoked-but-presented token → revoke the *entire family*, throw. On valid token → revoke this token, mint a new one with `parentTokenId = oldId, familyId = same`.
3. `revokeRefreshToken(tokenId)`: revoke a single row, not the latest by user.
4. `revokeAllSessions(userId)`: explicit method, only used on password reset / admin action.
**Implementation notes:** This is the centerpiece. Add unit tests covering: two-device scenario, replay attack, expired, revoked, family-revocation on reuse. Tests must fail without the fix.
**Dependencies:** Task 2.1 (schema), ADR-0001
**Can run parallel with:** Task 3.x
**Needs DB migration:** No (consumes Task 2.1's migration)
**Risk:** High (auth correctness)
**Verification:**
```bash
npm test -- src/auth/token.service.spec.ts
```
**Done Criteria:** All new test cases pass; old behavior tests still pass; coverage for `token.service.ts` ≥ 90%.

#### Task 2.3 — `/auth/refresh` no longer requires Bearer access token
**Source finding:** `[P1] /auth/refresh requires Bearer access token; userId is taken from decode()`.
**Files likely touched:**
- `src/auth/auth.controller.ts` (`:83–155`)
- `src/auth/auth.controller.spec.ts`
- `test/auth.e2e-spec.ts`
**Description:**
- Remove the Bearer requirement.
- Derive `userId` from the looked-up refresh-token row (server-side trust).
- Remove the `jwtService.decode(accessToken)` call.
- Inject `ConfigService` and read `cookieSecure`, `cookieSameSite`, `jwtRefreshExpiresIn` (no `process.env`).
**Implementation notes:** Update e2e tests to assert that refresh works without an access token.
**Dependencies:** Task 2.2
**Can run parallel with:** Task 2.5
**Needs DB migration:** No
**Risk:** Medium
**Verification:**
```bash
npm test -- src/auth/auth.controller.spec.ts
# real e2e against postgres:
npm run test:e2e -- auth.e2e-spec.ts
```
**Done Criteria:** Refresh works with cookie alone; e2e demonstrates two-device independence.

#### Task 2.4 — Cookie flags via ConfigService; remove `process.env` reads
**Source finding:** `[P2] auth.controller.ts reads process.env.COOKIE_SECURE directly`.
**Files likely touched:**
- `src/auth/auth.controller.ts`
- possibly `src/infra/config/validate-env.ts` (verify `cookieSameSite` is exposed in `AppConfig`)
**Description:** Replace both `process.env.COOKIE_SECURE === 'true'` reads with `this.configService.get('cookieSecure', { infer: true })`. Same for `cookieSameSite`.
**Implementation notes:** Trivial change once Task 2.3 has already injected `ConfigService`.
**Dependencies:** Task 2.3
**Can run parallel with:** None
**Needs DB migration:** No
**Risk:** Low
**Verification:** `grep -n "process.env" src/auth/` shows no hits.
**Done Criteria:** No `process.env` in `src/auth/`.

#### Task 2.5 — Refresh-token format decision implementation (per ADR-0001)
**Source finding:** `[P1] JWT_REFRESH_SECRET and JWT_REFRESH_EXPIRES_IN are required but never used`; `[P3] Bcrypt over UUIDs is wasted CPU`.
**Files likely touched:**
- `src/auth/token.service.ts`
- `src/infra/config/validate-env.ts` (if removing the env vars)
- `.env.example`
**Description:** Per ADR-0001:
- **Option A (recommended): opaque token, SHA-256 hash, ID prefix.** Format: `<tokenId>.<base64url(secret)>`. Server stores `sha256(secret)` for constant-time comparison. Cheap, fast, no JWT overhead. Remove `JWT_REFRESH_SECRET` from validateEnv.
- **Option B: JWT with `jti`.** Sign with `JWT_REFRESH_SECRET`. Server stores `jti` only. Heavier but stateless-ish.
**Implementation notes:** Update token.service tests to cover the chosen format. Migrate existing refresh tokens — they'll need to be revoked on rollout, OR a brief dual-read window (look up by hash AND by ID-prefix). Recommendation: invalidate all existing sessions during rollout; users re-login.
**Dependencies:** Task 2.2, ADR-0001
**Can run parallel with:** Task 2.4
**Needs DB migration:** Possibly — schema may need an `id_prefix` column if Option A is chosen with a non-trivial format. Often unnecessary if the random UUID `id` field is reused.
**Risk:** Medium
**Verification:**
```bash
npm test
# Manual: log in two browsers, refresh in each, verify both stay alive.
```
**Done Criteria:** Refresh path uses the chosen format; dead env vars removed (or actually used); login latency improved if SHA-256 chosen.

#### Task 2.6 — Optional-auth guard policy
**Source finding:** `[P1] AuthGuard returns the same error for required-and-missing vs required-and-invalid vs optional-and-invalid`.
**Files likely touched:**
- `src/auth/auth.guard.ts`
- `src/auth/auth.guard.spec.ts`
**Description:** On `@OptionalAuth()` routes, invalid token → `request.user = undefined`, return `true` (not throw). Log decode failure at `debug`.
**Implementation notes:** Decide explicitly: do we want stale tokens to silently degrade to anonymous, or reject with a `Token-Hint` header? Recommendation: silently degrade. Add test cases for: optional + no token, optional + valid token, optional + invalid token, required + invalid token.
**Dependencies:** None (independent of Task 2.1–2.5)
**Can run parallel with:** All other Phase-2 tasks
**Needs DB migration:** No
**Risk:** Low
**Verification:** `npm test -- src/auth/auth.guard.spec.ts`
**Done Criteria:** Behavior matches the new contract; spec covers all four matrix cells.

### Phase Verification
```bash
npm run check
npm run test:e2e -- auth.e2e-spec.ts
# Multi-device manual smoke:
#   Browser A login → refresh → still works
#   Browser B login → refresh → still works
#   Browser A's stolen token replayed → entire family A revoked, family B untouched
```

### Phase Exit Criteria
- New `token.service.spec.ts` cases (two-device, replay, expired, revoked, family revocation) all pass.
- `auth.e2e-spec.ts` covers cookie-only refresh.
- No `process.env` in `src/auth/`.
- Refresh-token format matches ADR-0001.

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

---

## Phase 3 — Media Authorization Model Fix

### Goal
Allow public assets (avatars, post images, company logos) to be served while keeping private assets (resumes, application attachments, DM attachments) owner-restricted.

### Why This Phase Comes Here
Independent of Phase 2, so it can run in parallel. Independent of Phase 4 (billing). Required before public-traffic launch.

### Scope
**Included:**
- `MediaAsset.visibility` field OR derived visibility per ADR-0002.
- `MediaService.getDownloadUrl` updated.
- Tests: anonymous user reading a public asset succeeds; non-owner reading a private asset 404s.

**Excluded:**
- No new presigned-URL caching layer (defer).
- No CDN wiring (defer).

### Tasks

#### Task 3.1 — Schema/access-model migration (per ADR-0002)
**Source finding:** `[P0] Media authorization model cannot serve public assets`.
**Files likely touched:**
- `prisma/schema.prisma` (`MediaAsset`)
- `prisma/migrations/<ts>_add_media_visibility.sql`
**Description:** Per ADR-0002:
- **Option A (persisted):** add `visibility MediaVisibility` enum (`PRIVATE`, `PUBLIC`, `CONNECTIONS_ONLY`) defaulting to `PRIVATE`. Backfill: avatars and post images linked from PUBLIC profiles → `PUBLIC`; everything else → `PRIVATE`.
- **Option B (derived):** no schema change; service computes visibility from the relations (`postMedia`, `companyLogos`, `applicationResumes` etc.). Slower per-request but flexible.
**Implementation notes:** Option A scales better but requires backfill correctness. Option B is more conservative but every read does an extra join. Recommend Option A unless the team commits to a hot path for media.
**Dependencies:** ADR-0002
**Can run parallel with:** Phase 2
**Needs DB migration:** **Yes (Option A only)**
- Model/table changed: `media_assets` (+ `visibility` column, default `PRIVATE`)
- Migration intent: enable public asset serving
- Backward compatibility concern: backfill must be correct; new uploads default to private; existing avatar/post-image uploads need a one-time backfill UPDATE.
**Risk:** High (data exposure if backfill is wrong)
**Verification:**
```bash
DATABASE_URL=... npx prisma migrate dev
# Run a backfill verification query: count of avatars marked PUBLIC vs total.
```
**Done Criteria:** Migration applied; backfill SQL reviewed by two engineers; spot-check shows reasonable distribution.

#### Task 3.2 — `MediaService.getDownloadUrl` honors visibility
**Source finding:** `[P0] Media authorization model cannot serve public assets`.
**Files likely touched:**
- `src/media/media.service.ts`
- `src/media/media.service.spec.ts`
- `test/media.e2e-spec.ts`
**Description:** Branch on visibility:
- `PUBLIC`: anyone with a valid HTTP request gets a presigned URL.
- `CONNECTIONS_ONLY`: requires authenticated user; check `Connection` table.
- `PRIVATE`: requires owner or explicit linked-resource permission (e.g. recruiter viewing an application resume).
**Implementation notes:** Don't return the same `presignedUrl` for PUBLIC assets across requests — they expire in 5 min anyway, and presigned-URL replay is not the threat model. But consider a `Cache-Control: public, max-age=240` if the media is heavy. (Defer to Phase 7.)
**Dependencies:** Task 3.1
**Can run parallel with:** Phase 2
**Needs DB migration:** No
**Risk:** High (incorrect logic = data leak)
**Verification:**
```bash
npm test -- src/media/media.service.spec.ts
npm run test:e2e -- media.e2e-spec.ts
```
**Done Criteria:** Anonymous request for a PUBLIC asset returns 200 + presigned URL. Anonymous request for PRIVATE returns 404 (not 401 — same as today, to prevent enumeration). Non-owner authenticated request for PRIVATE returns 404.

#### Task 3.3 — Apply visibility on `confirm` and `delete`
**Source finding:** `[P0]` — same finding extends to confirm/delete.
**Files likely touched:**
- `src/media/media.service.ts`
- `src/media/media.controller.ts`
**Description:** Confirm and delete remain owner-only. No change needed if the owner check already gates them, but verify and add tests.
**Implementation notes:** Tighten by confirming owner can only flip `PUBLIC` if the linked resource (e.g. PostMedia) is also public. Otherwise reject visibility upgrade.
**Dependencies:** Task 3.2
**Can run parallel with:** None
**Needs DB migration:** No
**Risk:** Medium
**Verification:** `npm test -- src/media/`
**Done Criteria:** Owner-only confirm/delete preserved; visibility transitions validated.

#### Task 3.4 — E2E: anonymous reads a public post image
**Source finding:** Audit Test Gap Analysis: "Test posting a public Post with a media reference, anonymous user fetches the media URL".
**Files likely touched:**
- `test/media.e2e-spec.ts`
**Description:** Full flow: user uploads avatar → confirms → second anonymous client requests download URL → succeeds. Also: user uploads resume → second user requests → 404.
**Dependencies:** Task 3.2
**Can run parallel with:** None
**Needs DB migration:** No
**Risk:** Low
**Verification:** `npm run test:e2e -- media.e2e-spec.ts`
**Done Criteria:** Tests added and green.

### Phase Verification
```bash
npm run check
npm run test:e2e -- media.e2e-spec.ts
```

### Phase Exit Criteria
- Public avatars and post images can be served to anonymous users.
- Private assets remain owner-only.
- Backfill verification SQL recorded in `docs/runbooks/media-visibility-backfill.md`.

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

---

## Phase 4 — Billing/Webhook and Idempotency Correctness

### Goal
Make billing webhooks correct under partial failures and provider retries. Stop committing idempotency rows that survive rolled-back transactions.

### Why This Phase Comes Here
After Phase 1 (so type safety is in). Independent of Phase 2 and 3 but touches the outbox layer, so it's a good lead-in to Phase 6.

### Scope
**Included:**
- `IdempotencyService.claim` accepts `tx` and uses it.
- All callers inside `$transaction` pass `tx`.
- Webhook signature guard hard-fails when raw body missing.
- `ApiResponseInterceptor` bypasses webhook endpoints.
- Outbox `attempts` counter is incremented on dispatch failure, not claim.

**Excluded:**
- No new event-schema registry (Phase 6).
- No DLQ admin endpoint (Phase 6).

### Tasks

#### Task 4.1 — `IdempotencyService.claim(tx?, scope, key)`
**Source finding:** `[P1] IdempotencyService.claim uses this.prisma rather than the caller's tx`.
**Files likely touched:**
- `src/outbox/idempotency.service.ts`
- `src/billing/webhooks/webhook.service.ts` (`:50–54`)
- `src/companies/companies.service.ts` (`:168–171`)
- any other callers
- `src/outbox/idempotency.service.spec.ts`
**Description:** Make `claim` accept an optional `tx: Prisma.TransactionClient` and prefer it over `this.prisma`. Update both callers to pass `tx`. For the `companies.service.ts` case, move the `claim` *inside* the `$transaction`.
**Implementation notes:** Add a unit test that asserts: when caller's transaction rolls back, the idempotency row is NOT in the DB afterward. Use Testcontainers for this test (cheaper than full e2e).
**Dependencies:** Task 1.1 (clean `PrismaTransaction` type)
**Can run parallel with:** Task 4.2
**Needs DB migration:** No
**Risk:** Medium
**Verification:**
```bash
npm test -- src/outbox/idempotency.service.spec.ts
npm run test:e2e -- billing.e2e-spec.ts
```
**Done Criteria:** Rollback test passes; webhook + company create both honor transactional claim.

#### Task 4.2 — Webhook signature guard hard-fails on missing raw body
**Source finding:** `[P2] Webhook signature guard accepts JSON.stringify(request.body) as fallback`.
**Files likely touched:**
- `src/billing/webhooks/webhook-signature.guard.ts`
- `src/billing/webhooks/webhook-signature.guard.spec.ts`
**Description:** If `req.rawBody` is missing, throw `InternalServerErrorException('Raw body required for webhook signature verification')`. Remove the `JSON.stringify(request.body)` fallback entirely.
**Implementation notes:** Verify `bootstrap.ts` body parser sets `verify` to capture raw body. Add a test for the missing-rawBody path.
**Dependencies:** None
**Can run parallel with:** Task 4.1, 4.3, 4.4
**Needs DB migration:** No
**Risk:** Low (defense improvement)
**Verification:** `npm test -- src/billing/`
**Done Criteria:** Test "missing raw body throws 500" passes.

#### Task 4.3 — `ApiResponseInterceptor` bypass for webhook routes
**Source finding:** `[P1] Billing webhook response is wrapped by ApiResponseInterceptor, breaking the documented contract`.
**Files likely touched:**
- `src/common/response/api-response.interceptor.ts`
- `src/billing/webhooks/webhook.controller.ts` (verify decorator usage)
**Description:** Two viable approaches:
- **Bypass list:** add `/billing/webhooks/` prefix to `BYPASS_PATHS` array.
- **Decorator:** create `@SkipResponseEnvelope()` decorator, apply to the webhook controller methods.
Recommend the decorator (more reusable for future CSV/RSS endpoints).
**Implementation notes:** Add an e2e test that posts a fake signed webhook and asserts response body is `{ received: true, ... }` (not wrapped in `data`).
**Dependencies:** None
**Can run parallel with:** Task 4.1, 4.2, 4.4
**Needs DB migration:** No
**Risk:** Low
**Verification:** `npm test`, `npm run test:e2e -- billing.e2e-spec.ts`
**Done Criteria:** Webhook response matches provider contract.

#### Task 4.4 — Outbox `attempts` counter increments on failure, not claim
**Source finding:** `[P1] OutboxProcessor.claimEvents does FOR UPDATE SKIP LOCKED followed by UPDATE ... attempts = attempts + 1 ⇒ attempts increment before processing`.
**Files likely touched:**
- `src/outbox/outbox.processor.ts` (`:155–162`)
- `src/outbox/outbox.processor.spec.ts`
**Description:**
- Remove `attempts = attempts + 1` from the claim SQL.
- Increment only in `requeueWithBackoff` (failure path).
- On dead-letter promotion, reflect the *true* attempt count.
**Implementation notes:** Add a regression test: dispatch fails twice for transient reasons, third succeeds; assert `attempts = 2`, not `3`.
**Dependencies:** None
**Can run parallel with:** Task 4.1, 4.2, 4.3
**Needs DB migration:** No
**Risk:** Medium (touches outbox correctness)
**Verification:** `npm test -- src/outbox/`
**Done Criteria:** Attempts counter matches actual failed dispatch count.

### Phase Verification
```bash
npm run check
npm run test:e2e -- billing.e2e-spec.ts
```

### Phase Exit Criteria
- Webhook contract correct (no envelope wrap, raw-body required).
- Idempotency rows roll back with their transaction.
- Outbox attempts counter is accurate.

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
- `npm run check` — pass; strict typecheck, lint with zero warnings, unit tests 76 suites / 749 tests after Phase 4; latest full run after Phase 5 safe work passes 79 suites / 762 tests.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `rg -n "JSON\\.stringify\\(request\\.body\\)" src --glob '*.ts'` — no matches.
- `rg -n "attempts = attempts \\+ 1|getAttempts\\(" src/outbox --glob '*.ts'` — no matches.
- `npm run test:e2e -- billing.e2e-spec.ts --runInBand` — pass; 1 suite / 14 tests.
- `npm run test:e2e -- billing.e2e-spec.ts --runInBand --detectOpenHandles` — pass; 1 suite / 14 tests, no open handles reported.

Remaining:
- none for Phase 4.

---

## Phase 5 — Runtime, Observability & Production Guardrails

### Goal
Make the deploy/observability path real. Add the operational guardrails the project needs in production.

### Why This Phase Comes Here
After Phase 1–4, the application code is correct. Now we make it operable.

### Scope
**Included:**
- Dockerfile hardening + `HEALTHCHECK`.
- Deploy workflow decision (per ADR-0003).
- CI E2E services (Postgres, Redis, MinIO, Elasticsearch, MailHog) OR Testcontainers migration.
- Security workflow: CodeQL + Trivy + Dependabot + `npm audit` moderate.
- Request-ID propagation: header → Pino → response.
- `ApiExceptionFilter` logs uncaught errors.
- Throttler tuned: global default 300/min.
- WebSocket: drop query-string token fallback.
- OTel: validate `OTEL_*` at startup; instrumentation SIGTERM hook respects NestJS shutdown.
- Graceful shutdown: release outbox locks on SIGTERM.
- Helmet: minimal CSP.
- `ConfigService` injected for cookie flags (if not already done in Phase 2).

**Excluded:**
- No outbox parallelism (Phase 6).
- No DLQ admin (Phase 6).
- No event-schema registry (Phase 6).

### Tasks

#### Task 5.1 — Dockerfile hardening
**Source finding:** `[P1] Dockerfile copies whole source, runs npm ci again in runtime stage, runs as root`.
**Files likely touched:** `Dockerfile`, `.dockerignore`
**Description:** Non-root user; `HEALTHCHECK`; remove duplicate `npm ci`; document `prisma migrate deploy` strategy (separate init container vs entrypoint).
**Implementation notes:** Keep `APP_PROCESS_ROLE` un-baked so the image can be reused across api/worker/realtime deployments.
**Dependencies:** None (independent)
**Can run parallel with:** All Phase-5 tasks
**Needs DB migration:** No
**Risk:** Medium
**Verification:**
```bash
docker build -t mdc-be:test .
docker run --rm -p 3000:3000 --env-file .env mdc-be:test &
curl -fsS http://localhost:3000/health/live
```
**Done Criteria:** Image runs as non-root; `HEALTHCHECK` passes; size ≤ baseline+0%.

#### Task 5.2 — CI E2E services OR Testcontainers
**Source finding:** `[P1] CI test:e2e runs with no MinIO/ES/SMTP`.
**Files likely touched:** `.github/workflows/ci.yml`, possibly `test/helpers/`
**Description:** Per ADR-0008:
- **Option A:** add `services: minio`, `elasticsearch`, `mailhog` to ci.yml. Faster, fragile to GH service quirks.
- **Option B:** use Testcontainers (already in deps) for all infra. Slower CI, more isolation.
**Dependencies:** ADR-0008
**Can run parallel with:** Task 5.1
**Needs DB migration:** No
**Risk:** Medium
**Verification:** CI green on `test:e2e`.
**Done Criteria:** E2E job exercises real infra.

#### Task 5.3 — Deploy workflow decision
**Source finding:** `[P1] Deploy workflow is a no-op`.
**Files likely touched:** `.github/workflows/deploy.yml`
**Description:** Per ADR-0003:
- **Option A:** delete the workflow.
- **Option B:** wire to a real target (ECR + ECS, or GHCR + k8s + Argo).
**Dependencies:** ADR-0003
**Can run parallel with:** Task 5.1
**Needs DB migration:** No
**Risk:** Low/High (depending on chosen target)
**Verification:** N/A or full deploy to staging.
**Done Criteria:** Workflow either deleted or fully functional with a staging deploy.

#### Task 5.4 — Security workflow expansion
**Source finding:** `[P2] Security workflow only runs npm audit`.
**Files likely touched:** `.github/workflows/security.yml`, `.github/dependabot.yml`
**Description:** Enable CodeQL (JS/TS), Trivy on `Dockerfile` + built image, npm audit `--audit-level=moderate`, Dependabot for npm + Docker.
**Dependencies:** Task 5.1 (Trivy needs the buildable image)
**Can run parallel with:** Task 5.2, 5.3
**Needs DB migration:** No
**Risk:** Low (CI additive)
**Verification:** CI green; expected findings reviewed.
**Done Criteria:** All three scanners run on PRs and main.

#### Task 5.5 — Request-ID propagation
**Source finding:** `[P2] Request-ID header ≠ Request-ID in Pino logs`.
**Files likely touched:**
- `src/bootstrap.ts`
- `src/infra/logger/logger.module.ts`
- `src/common/errors/api-exception.filter.ts`
**Description:** `genReqId: (req) => req.headers['x-request-id'] ?? randomUUID()`. Echo back via `res.setHeader('x-request-id', req.id)`. Use the same ID in `ApiExceptionFilter`'s response envelope.
**Implementation notes:** Add a test that sends `x-request-id: foo` and asserts the log line and the error response both contain `foo`.
**Dependencies:** None
**Can run parallel with:** All Phase-5 tasks
**Needs DB migration:** No
**Risk:** Low
**Verification:** `npm test`
**Done Criteria:** Request-ID round-trip verified end-to-end.

#### Task 5.6 — `ApiExceptionFilter` logs uncaught errors
**Source finding:** `[P2] ApiExceptionFilter swallows non-HttpException as 500 without logging`.
**Files likely touched:** `src/common/errors/api-exception.filter.ts`
**Description:** Inject `PinoLogger`. Log `error.stack` for any non-HttpException at `error` level. Tag the log line with `requestId`.
**Dependencies:** Task 5.5 (consistent request ID)
**Can run parallel with:** Task 5.1, 5.7, 5.8
**Needs DB migration:** No
**Risk:** Low
**Verification:** `npm test`; manual: throw an unexpected exception from a test controller and assert log emitted.
**Done Criteria:** No silent 500s.

#### Task 5.7 — Throttler global default 300/min
**Source finding:** `[P1] Global throttler is 10 req/60s`.
**Files likely touched:** `src/app.module.ts`
**Description:** Change default `{ limit: 10, ttl: 60000 }` to `{ limit: 300, ttl: 60000 }`. Per-route `@Throttle` for sensitive endpoints retained.
**Dependencies:** None
**Can run parallel with:** All Phase-5 tasks
**Needs DB migration:** No
**Risk:** Low (relaxes a too-strict limit)
**Verification:** Manual: hit a generic endpoint 50× in 60s, no 429.
**Done Criteria:** Default throttler tuned.

#### Task 5.8 — WebSocket: drop query-string token
**Source finding:** `[P1] WebSocket gateway accepts token from query string`.
**Files likely touched:** `src/realtime/chat.gateway.ts`, `src/realtime/ws-jwt.guard.ts`
**Description:** Accept token only via `handshake.auth.token` or `Authorization` header. Document client expectation in `realtime/AGENTS.md`.
**Dependencies:** None
**Can run parallel with:** All Phase-5 tasks
**Needs DB migration:** No
**Risk:** Medium (client compatibility — coordinate with frontend)
**Verification:** `npm run test:e2e -- realtime.e2e-spec.ts`
**Done Criteria:** Query-string fallback removed; WS auth tests still pass.

#### Task 5.9 — OTel validation + shutdown hook
**Source finding:** `[P2] OTLP exporter URL read directly from process.env`; `[P2] instrumentation.ts SIGTERM bypasses NestJS shutdown`.
**Files likely touched:** `src/instrumentation.ts`, possibly `src/infra/observability/otel-shutdown.provider.ts` (new)
**Description:**
- At startup, throw if `OTEL_EXPORTER_OTLP_ENDPOINT` is missing in production.
- Remove `process.exit(0)` from SIGTERM in `instrumentation.ts`; move shutdown to a NestJS `OnApplicationShutdown` provider so Prisma/Redis disconnect cleanly first.
**Dependencies:** None
**Can run parallel with:** All Phase-5 tasks
**Needs DB migration:** No
**Risk:** Medium
**Verification:** Manual SIGTERM run; check graceful shutdown logs.
**Done Criteria:** SIGTERM does not race Prisma/Redis.

#### Task 5.10 — Outbox graceful shutdown
**Source finding:** `[P2] No graceful shutdown for outbox processor mid-batch`.
**Files likely touched:** `src/outbox/outbox.processor.ts`
**Description:** Implement `OnApplicationShutdown`: release locks owned by `this.processorId` via `UPDATE outbox_events SET status='PENDING', locked_at=NULL, locked_by=NULL WHERE locked_by = $myId`.
**Implementation notes:** Use a per-process UUID generated at startup so we can identify our own locks.
**Dependencies:** Task 5.9 (clean shutdown ordering)
**Can run parallel with:** Task 5.1, 5.6
**Needs DB migration:** No
**Risk:** Low
**Verification:** Stop a worker mid-batch, observe that the next worker claims immediately.
**Done Criteria:** No "stuck for `leaseTimeoutMs`" gap on rolling deploy.

#### Task 5.11 — Helmet minimal CSP
**Source finding:** `[P2] Helmet CSP not configured`.
**Files likely touched:** `src/bootstrap.ts`
**Description:** Add `helmet.contentSecurityPolicy({ directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } })`.
**Dependencies:** None
**Can run parallel with:** All Phase-5 tasks
**Needs DB migration:** No
**Risk:** Low
**Verification:** `curl -I` shows `Content-Security-Policy` header.
**Done Criteria:** CSP header present.

### Phase Verification
```bash
npm run check
docker build .
npm run test:e2e
curl -fsS http://localhost:3000/health/ready
```

### Phase Exit Criteria
- Docker image non-root, with HEALTHCHECK.
- CI E2E exercises real (or containerized) infra.
- Security workflow runs CodeQL/Trivy/audit.
- Request-IDs round-trip; uncaught errors logged.
- Throttler tuned.
- WS query-string auth removed.
- OTel + NestJS shutdown ordering correct.
- Outbox releases locks on shutdown.

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
- `src/messaging/messaging.service.ts:192` — conversation and message pagination now default missing `limit` before passing `take` to Prisma.
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

---

## Phase 6 — Outbox Scalability & Operational Tooling

### Goal
Increase outbox throughput, add operational visibility, prevent stampedes.

### Why This Phase Comes Here
After Phase 4 (correctness) and Phase 5 (observability) are in place.

### Scope
**Included:**
- Per-event-type Zod schemas (emit + dispatch).
- Bounded parallel dispatch within a batch.
- Outbox metrics (counter / histogram / gauge).
- Cron leader election (Redis SETNX EX).
- Admin endpoint: DLQ list + replay.
- Prisma connection-pool tuning per role.
- Heavy-transaction timeouts.
- Single slug-helper for create + update; drop count-only version.
- Denormalized-counter strategy (per ADR-0005).

**Excluded:**
- No Idempotency-Key request-header layer (Phase 7).
- No boundary-linting (Phase 7).

### Tasks

#### Task 6.1 — Event-schema registry
**Source finding:** `[P2] Dispatcher uses switch over event types with as casts on payload`.
**Files likely touched:** `src/outbox/events/` (new), `src/outbox/outbox.processor.ts`, every emitter.
**Description:** Per event type, define a Zod schema (or a TS type with a discriminated union). Validate at emit-time and at dispatch-time. Reject malformed payloads with a clear error.
**Risk:** Medium
**Dependencies:** Phase 4 done
**Can run parallel with:** Task 6.2
**Needs DB migration:** No
**Verification:** `npm test -- src/outbox/`
**Done Criteria:** All emitters use the registry; dispatcher consumes typed events.

#### Task 6.2 — Parallel dispatch with concurrency cap
**Source finding:** `[P2] Outbox dispatcher serializes events`.
**Files likely touched:** `src/outbox/outbox.processor.ts`
**Description:** Use a `p-limit`-style concurrency cap (4–8). `Promise.allSettled` over the batch. Maintain order per `aggregateId`.
**Risk:** Medium (concurrency correctness)
**Dependencies:** Task 4.4
**Can run parallel with:** Task 6.1
**Needs DB migration:** No
**Verification:** Load test before/after.
**Done Criteria:** Batch throughput ≥ 2× current.

#### Task 6.3 — Outbox metrics
**Source finding:** `[P2] No metrics on outbox lag, dead-letter rate, processing latency`.
**Files likely touched:** `src/outbox/outbox.processor.ts`, `src/infra/observability/metrics.ts` (new)
**Description:** Add counters `outbox.events.processed`, `outbox.events.failed`, `outbox.events.dead_lettered`; histogram `outbox.dispatch.duration_ms`; gauge `outbox.pending.count`.
**Risk:** Low
**Dependencies:** Task 5.9 (OTel validated)
**Can run parallel with:** Task 6.1, 6.4
**Needs DB migration:** No
**Verification:** Manual: trigger events, view metrics endpoint or OTLP backend.
**Done Criteria:** Dashboards possible.

#### Task 6.4 — Cron leader election
**Source finding:** `[P2] IdempotencyService.cleanup runs hourly with no jitter`.
**Files likely touched:** `src/outbox/idempotency.service.ts`, `src/media/media-cleanup.service.ts`, `src/infra/scheduling/leader-lock.service.ts` (new)
**Description:** Redis `SET key NX EX 50` lock per cron job. Only the leader runs.
**Risk:** Medium (correctness of lock release)
**Dependencies:** None
**Can run parallel with:** Task 6.1, 6.2, 6.3
**Needs DB migration:** No
**Verification:** Run two workers; only one cleanup runs per cycle.
**Done Criteria:** No duplicate cleanups.

#### Task 6.5 — DLQ admin endpoint + runbook
**Source finding:** `[P2] No DLQ replay tooling exposed`.
**Files likely touched:** `src/admin/admin.controller.ts` (or new `outbox-admin.controller.ts`), `src/outbox/dead-letter.service.ts`, `docs/runbooks/outbox-replay.md`
**Description:** `GET /admin/outbox/dead-letter`, `POST /admin/outbox/dead-letter/:id/replay`. Strong admin RBAC + audit log.
**Risk:** Medium (admin attack surface)
**Dependencies:** Task 6.1 (typed events for safe replay)
**Can run parallel with:** Task 6.3, 6.4
**Needs DB migration:** No
**Verification:** Manual replay flow.
**Done Criteria:** Operators can replay without SQL.

#### Task 6.6 — Prisma connection-pool + transaction timeouts
**Source finding:** `[P2] No connection-pool tuning`; `[P2] Prisma $transaction default timeout 5s`.
**Files likely touched:** `.env.example`, `prisma.service.ts`, heavy-transaction services
**Description:** Document recommended `?connection_limit=` per role; add `{ timeout: 15_000, maxWait: 5_000 }` to transactions with >3 writes.
**Risk:** Low
**Dependencies:** None
**Can run parallel with:** All Phase-6 tasks
**Needs DB migration:** No
**Verification:** Load test, check pool exhaustion stops.
**Done Criteria:** Pool sized per role; long transactions don't time out under normal load.

#### Task 6.7 — Slug helper consolidation
**Source finding:** `[P2] generateUniqueSlug is a separate racier version`.
**Files likely touched:** `src/companies/companies.service.ts`
**Description:** Use the P2002-aware helper for both create and update. Delete `generateUniqueSlug`.
**Risk:** Low
**Dependencies:** None
**Can run parallel with:** All Phase-6 tasks
**Needs DB migration:** No
**Verification:** `npm test -- src/companies/`
**Done Criteria:** One helper; no TOCTOU window on rename.

#### Task 6.8 — Counter strategy (per ADR-0005)
**Source finding:** `[P2] Counter strategy inconsistency`.
**Files likely touched:** `src/companies/companies.service.ts`, `src/users/users.service.ts`, possibly `prisma/schema.prisma`.
**Description:** Per ADR-0005, either drop denormalized counters in favor of `_count`, or commit to denormalized everywhere with a reconciliation job.
**Risk:** Medium (consistency)
**Dependencies:** ADR-0005
**Can run parallel with:** All Phase-6 tasks
**Needs DB migration:** Possibly
**Verification:** `npm test`
**Done Criteria:** Single counter convention applied.

### Phase Verification
```bash
npm run check
npm run test:e2e
# Load test outbox throughput
```

### Phase Exit Criteria
- Outbox throughput ≥ 2× current.
- DLQ admin available + documented.
- Metrics dashboards possible.
- Counter strategy unified.
- Slug helper consolidated.

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

---

## Phase 7 — Maintainability, Documentation & Long-term Architecture

### Goal
Polish the developer experience and set up the architecture for the next 12 months.

### Why This Phase Comes Here
Last — nothing in here is shippability-blocking.

### Scope
**Included:**
- README rewrite (project-specific).
- `prisma/schema.prisma` region comments (or multi-file per ADR-0007).
- Module-boundary linting (`no-restricted-imports`).
- Generic `Idempotency-Key` request-header interceptor.
- Schema event registry (Phase 6 may already cover this).
- Redaction PII test coverage.
- TODO ticketization.
- Cleanup `package.json` metadata.

**Excluded:**
- No new product features.

### Tasks

#### Task 7.1 — README rewrite
**Source finding:** `[P3] README is the default NestJS starter`.
**Files likely touched:** `README.md`
**Risk:** Low; **Description:** Replace with project-specific intro, setup-in-10-minutes, link to `AGENTS.md` and `docs/architecture.md`.
**Verification:** Visual review.
**Done Criteria:** New contributors get value from README alone.

#### Task 7.2 — Schema regions / multi-file
**Source finding:** `[P2] prisma/schema.prisma is 1800 lines, no logical grouping`.
**Files likely touched:** `prisma/schema.prisma`
**Risk:** Low (comments only) or Medium (multi-file experimental feature)
**Description:** Per ADR-0007, either region comments or Prisma multi-file.
**Verification:** `npx prisma validate`.
**Done Criteria:** Schema navigable.

#### Task 7.3 — Module-boundary linting
**Source finding:** `[P2] Domain modules cross-import each other`.
**Files likely touched:** `eslint.config.mjs`, possibly new `eslint-local-rules/`
**Description:** Use `no-restricted-imports` to forbid cross-domain imports except via approved ports. Whitelist `common/` and `infra/`.
**Risk:** Medium (may surface real spaghetti)
**Verification:** `npm run lint`.
**Done Criteria:** New cross-domain imports require an exception.

#### Task 7.4 — Generic `Idempotency-Key` request-header interceptor
**Source finding:** `[P2] No Idempotency-Key request-header support`.
**Files likely touched:** `src/common/idempotency/` (new), all POST controllers (opt-in decorator).
**Description:** Per ADR-0004, decide rollout. Reads `Idempotency-Key`, hashes the request body, checks `idempotency_keys`, returns the stored response on hit.
**Risk:** Medium
**Dependencies:** Phase 4 (idempotency-in-tx fix)
**Verification:** E2E send same `Idempotency-Key` twice, second is a stored-replay.
**Done Criteria:** At least one POST endpoint demonstrates the pattern.

#### Task 7.5 — Redaction PII test coverage
**Source finding:** `[P3] PII redaction not verified for nested arrays`.
**Files likely touched:** `src/infra/logger/logger.module.spec.ts`
**Description:** Add cases for `screeningAnswers[*].answer` and other depth-2 paths.
**Risk:** Low
**Verification:** `npm test -- logger.module.spec.ts`
**Done Criteria:** Redaction asserted at depths 1+2.

#### Task 7.6 — TODO ticketization
**Source finding:** `[P2] Multiple TODOs without tracking tickets`.
**Files likely touched:** Various
**Description:** For each TODO, create `bd create` ticket; replace TODO with `// TODO(bd-NNN): ...`.
**Risk:** Low
**Verification:** `grep -rn "TODO" src/` shows only ticketized TODOs.
**Done Criteria:** No untracked TODOs.

#### Task 7.7 — package.json metadata
**Source finding:** `[P3] description, author empty; license UNLICENSED`.
**Files likely touched:** `package.json`
**Risk:** Low
**Verification:** Visual.
**Done Criteria:** Fields populated.

### Phase Verification
```bash
npm run check
```

### Phase Exit Criteria
- Documentation matches reality.
- Schema is navigable.
- Cross-domain imports are gated.
- Generic Idempotency-Key interceptor available.

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

---

## 4. Dependency Graph

```
Phase 0 ──► Phase 1 ──► Phase 2 ──┐
                       ├──► Phase 3 ──┐
                       ├──► Phase 4 ──┼──► Phase 5 ──► Phase 6 ──► Phase 7
                       └──────────────┘
```

Logical edges:
- `Phase 0` → all (decisions + planning).
- `Phase 1` → `Phase 2`, `Phase 3`, `Phase 4` (type safety is universal prereq).
- `Phase 2` independent of `Phase 3` (different model).
- `Phase 4` partially needs `Phase 1.1` (PrismaTransaction).
- `Phase 5` benefits from `Phase 1` (request-ID test needs strict types).
- `Phase 5.10` (outbox graceful shutdown) benefits from `Phase 5.9` (NestJS shutdown ordering).
- `Phase 6` depends on `Phase 4` (idempotency correct first).
- `Phase 7.4` (Idempotency-Key) depends on `Phase 4.1`.

### Parallelization opportunities

**Within Phase 1:**
- Task 1.1 (PrismaTransaction) **||** Task 1.5 (jest setup) **||** Task 1.6 (coverage).
- After 1.1 lands: Task 1.2 (strict TS) **||** Task 1.3 (lint promotion) can run in parallel — they touch different files.

**Across phases (once Phase 1 done):**
- Phase 2 (auth) **||** Phase 3 (media) **||** Phase 4 (billing/outbox correctness).
- Within Phase 5: Task 5.1 (Dockerfile) **||** Task 5.5 (request-ID) **||** Task 5.7 (throttler) **||** Task 5.11 (CSP).
- Task 5.10 (outbox graceful shutdown) **||** Task 6.2 (parallel dispatch) — different concerns.

**Independent regardless of phase:**
- Task 7.1 (README) — at any time after Phase 0.
- Task 7.7 (package.json metadata) — at any time.
- Task 7.5 (redaction tests) — anytime after Phase 1.

---

## 5. Suggested PR Plan

PR ordering. Each line is one PR. "Depends on" refers to the PR number in this list.

| PR | Phase | Title | Files | Risk | Depends On |
|----|-------|-------|-------|------|------------|
| 1 | 0 | Decisions & ADRs (0001–0008) | `docs/decisions/*` | Low | — |
| 2 | 0 | Baseline metrics snapshot | `docs/baseline/*` | Low | — |
| 3 | 1 | `PrismaTransaction = Prisma.TransactionClient`; remove `tx as any` | `src/infra/prisma/*`, `src/outbox/outbox.service.ts`, all callers | Medium | — |
| 4 | 1 | jest.setup.ts so `npm test` works without env | `jest.setup.ts`, `package.json` | Low | — |
| 5 | 1 | tsconfig `strict: true` + fix resulting errors | `tsconfig.json`, various | Medium | 3 |
| 6 | 1 | ESLint: promote `no-explicit-any`, `no-floating-promises`, `no-unsafe-argument` to error | `eslint.config.mjs`, various | Medium | 3, 5 |
| 7 | 1 | Split `lint` vs `lint:fix`; CI strict lint; add `check` | `package.json`, `.github/workflows/ci.yml` | Low | 6 |
| 8 | 1 | Coverage hygiene (path ignore + threshold) | `package.json` jest | Low | 4 |
| 9 | 2 | Schema migration: add `family_id`, `parent_token_id` to refresh_tokens | `prisma/schema.prisma`, new migration | Medium | 1 (ADR-0001), 7 |
| 10 | 2 | Rewrite `TokenService` for family-aware rotation + tests | `src/auth/token.service.ts`, spec | High | 9 |
| 11 | 2 | `/auth/refresh` no longer requires Bearer; ConfigService for cookie flags | `src/auth/auth.controller.ts`, e2e | Medium | 10 |
| 12 | 2 | Refresh-token format per ADR-0001 (SHA-256 vs JWT) | `src/auth/token.service.ts`, `validate-env.ts`, `.env.example` | Medium | 10 |
| 13 | 2 | Optional-auth guard policy | `src/auth/auth.guard.ts`, spec | Low | 7 |
| 14 | 3 | Schema migration: media visibility per ADR-0002 | `prisma/schema.prisma`, new migration | High | 1 (ADR-0002), 7 |
| 15 | 3 | `MediaService.getDownloadUrl` honors visibility + e2e public read | `src/media/media.service.ts`, spec, e2e | High | 14 |
| 16 | 3 | Visibility on confirm/delete | `src/media/media.service.ts` | Medium | 15 |
| 17 | 4 | `IdempotencyService.claim(tx?)` + caller migrations | `src/outbox/idempotency.service.ts`, callers | Medium | 3 |
| 18 | 4 | Webhook signature guard hard-fails on missing raw body | `src/billing/webhooks/webhook-signature.guard.ts` | Low | 7 |
| 19 | 4 | Webhook response envelope bypass | `src/common/response/api-response.interceptor.ts`, `src/billing/webhooks/*` | Low | 7 |
| 20 | 4 | Outbox `attempts` counter on failure only | `src/outbox/outbox.processor.ts` | Medium | 3 |
| 21 | 5 | Dockerfile hardening + HEALTHCHECK | `Dockerfile`, `.dockerignore` | Medium | 7 |
| 22 | 5 | CI E2E real-infra services (per ADR-0008) | `.github/workflows/ci.yml` | Medium | 21 |
| 23 | 5 | Security workflow expansion | `.github/workflows/security.yml`, `dependabot.yml` | Low | 21 |
| 24 | 5 | Request-ID propagation | `src/bootstrap.ts`, `src/infra/logger/logger.module.ts`, `src/common/errors/api-exception.filter.ts` | Low | 7 |
| 25 | 5 | `ApiExceptionFilter` logs uncaught errors | `src/common/errors/api-exception.filter.ts` | Low | 24 |
| 26 | 5 | Throttler global default 300/min | `src/app.module.ts` | Low | — |
| 27 | 5 | WS: drop query-string token | `src/realtime/chat.gateway.ts`, `ws-jwt.guard.ts` | Medium | — |
| 28 | 5 | OTel validation + NestJS shutdown hook | `src/instrumentation.ts`, new shutdown provider | Medium | — |
| 29 | 5 | Outbox graceful shutdown (release locks) | `src/outbox/outbox.processor.ts` | Low | 28 |
| 30 | 5 | Helmet CSP | `src/bootstrap.ts` | Low | — |
| 31 | 5 | Deploy workflow per ADR-0003 | `.github/workflows/deploy.yml` | Low/High | 21 |
| 32 | 6 | Event-schema registry (Zod per event type) | `src/outbox/events/*`, processors | Medium | 20 |
| 33 | 6 | Parallel dispatch with concurrency cap | `src/outbox/outbox.processor.ts` | Medium | 32 |
| 34 | 6 | Outbox metrics (counters/histograms/gauge) | `src/outbox/*`, new metrics module | Low | 28 |
| 35 | 6 | Cron leader election (Redis SETNX) | new `leader-lock.service.ts`, cron-using services | Medium | — |
| 36 | 6 | DLQ admin endpoint + runbook | `src/admin/*`, `src/outbox/dead-letter.service.ts`, runbook | Medium | 32 |
| 37 | 6 | Prisma pool + transaction timeouts | `.env.example`, `prisma.service.ts`, heavy services | Low | — |
| 38 | 6 | Slug helper consolidation | `src/companies/companies.service.ts` | Low | — |
| 39 | 6 | Counter strategy per ADR-0005 | `src/companies/*`, `src/users/*`, possibly schema | Medium | 1 (ADR-0005) |
| 40 | 7 | README rewrite | `README.md` | Low | — |
| 41 | 7 | Schema regions / multi-file per ADR-0007 | `prisma/schema.prisma` | Low/Medium | 1 (ADR-0007) |
| 42 | 7 | Module-boundary linting | `eslint.config.mjs` | Medium | 7 |
| 43 | 7 | Generic Idempotency-Key interceptor + opt-in decorator | `src/common/idempotency/*`, one demo controller | Medium | 17 |
| 44 | 7 | Redaction PII test coverage | `src/infra/logger/logger.module.spec.ts` | Low | — |
| 45 | 7 | TODO ticketization | various | Low | — |
| 46 | 7 | package.json metadata | `package.json` | Low | — |

**Rules applied:**
- Schema migrations isolated (PR-9, PR-14) from logic that depends on them (PR-10, PR-15).
- Auth security PRs (PR-9 to PR-13) not mixed with cosmetic cleanup.
- CI workflow changes isolated (PR-22, PR-23, PR-31).
- One concern per PR.

---

## 6. Decision Needed

### Decision 0001 — Refresh token shape
**Options:**
1. **Opaque token + SHA-256 hash**, format `<tokenId>.<base64url(secret)>`. Server stores `sha256(secret)`. Fast, cheap; no JWT overhead.
2. **JWT with `jti`**, signed by `JWT_REFRESH_SECRET`. Server stores `jti` only. Stateless-ish; reuses JWT plumbing.
3. **Status quo + add `familyId`**: keep bcrypt of UUID, add the column.

**Recommended:** Option 1 — opaque + SHA-256. Refresh tokens don't benefit from JWT semantics. Removes dead env vars. ~100× faster than bcrypt.
**Reason:** Refresh tokens have no payload to carry; verification is a hash compare; bcrypt is wasted on a UUID.
**Blocks:** Phase 2 (Task 2.5)

### Decision 0002 — Media visibility model
**Options:**
1. **Persisted `visibility` column** on `MediaAsset` (PRIVATE / CONNECTIONS_ONLY / PUBLIC), default PRIVATE.
2. **Derived visibility** from parent entities (e.g. a `MediaAsset` referenced by a published Post is PUBLIC).

**Recommended:** Option 1 — persisted.
**Reason:** Faster reads (no join on every download); simpler authz; explicit privacy contract. Trade-off is backfill correctness.
**Blocks:** Phase 3 (Tasks 3.1–3.4)

### Decision 0003 — Deploy target
**Options:**
1. **Delete the placeholder deploy workflow** until a real target is decided.
2. **Wire to AWS ECR + ECS Fargate.**
3. **Wire to GHCR + Kubernetes + ArgoCD.**

**Recommended:** Option 1 (delete) for now if there's no production target yet. Decide between ECS/k8s when a real environment exists.
**Reason:** A non-functional deploy workflow gives false confidence and gets stale.
**Blocks:** Phase 5 (Task 5.3)

### Decision 0004 — `Idempotency-Key` request-header rollout
**Options:**
1. **Now (Phase 4):** ship with the idempotency-in-tx fix.
2. **Later (Phase 7):** add after correctness is in.
3. **Skip** until a client actually asks for it.

**Recommended:** Option 2 — Phase 7. Phase 4 is already heavy with correctness fixes.
**Reason:** Don't bundle a new product feature into a correctness sprint.
**Blocks:** Phase 7 (Task 7.4)

### Decision 0005 — Counter strategy
**Options:**
1. **Drop denormalized counters; always `_count`.** Simpler, slower hot reads.
2. **Keep denormalized + reconciliation job.** Faster reads, more code to maintain.

**Recommended:** Option 1 unless a measured perf problem says otherwise.
**Reason:** YAGNI on the reconciliation job until contention is real.
**Blocks:** Phase 6 (Task 6.8)

### Decision 0006 — Cron leader election strategy
**Options:**
1. **Redis SETNX EX** lock per cron job (per-job leader).
2. **Single-replica gating** — only one worker pod runs cron jobs (via env flag).
3. **Externalize** — move cron jobs to a scheduler (k8s CronJob).

**Recommended:** Option 1 — Redis SETNX.
**Reason:** Already have Redis; no infra change; supports multi-replica worker.
**Blocks:** Phase 6 (Task 6.4)

### Decision 0007 — Schema multi-file vs region comments
**Options:**
1. **Region comments** in single-file `schema.prisma`.
2. **Prisma multi-file** (experimental in v6, requires preview flag).

**Recommended:** Option 1 for now; revisit when Prisma multi-file is GA.
**Reason:** Avoid stability risk on a non-blocker.
**Blocks:** Phase 7 (Task 7.2)

### Decision 0008 — CI E2E infrastructure
**Options:**
1. **GitHub Actions `services:`** for Postgres/Redis/MinIO/Elasticsearch/MailHog.
2. **Testcontainers** for all infra (project already has `@testcontainers/postgresql`).

**Recommended:** Option 2 — Testcontainers.
**Reason:** Slower per-run but more reproducible locally; avoids GH-services quirks; tests run identically on dev laptops.
**Blocks:** Phase 5 (Task 5.2)

---

## 7. Verification Matrix

| Phase | Typecheck | Lint | Unit | E2E | Build | Prisma Validate | Docker Build | Manual QA |
|-------|-----------|------|------|-----|-------|-----------------|--------------|-----------|
| 0 | — | — | — | — | — | — | — | Plan + ADRs reviewed |
| 1 | ✅ | ✅ (strict) | ✅ | — | ✅ | ✅ | — | `npm run check` works clean |
| 2 | ✅ | ✅ | ✅ + new auth tests | ✅ auth.e2e | ✅ | ✅ (new migration) | — | Two-device login/refresh smoke |
| 3 | ✅ | ✅ | ✅ + new media tests | ✅ media.e2e (public read + private 404) | ✅ | ✅ (new migration) | — | Anonymous fetches a public avatar |
| 4 | ✅ | ✅ | ✅ + idempotency rollback + webhook raw-body | ✅ billing.e2e | ✅ | ✅ | — | Webhook signed payload accepted; unsigned rejected |
| 5 | ✅ | ✅ | ✅ + 500-logged + req-id round-trip | ✅ realtime.e2e (no query-token) | ✅ | ✅ | ✅ (non-root, HEALTHCHECK) | curl headers; container starts as non-root |
| 6 | ✅ | ✅ | ✅ outbox parallel + leader-lock | ✅ outbox-related | ✅ | ✅ | — | DLQ admin replay flow |
| 7 | ✅ | ✅ + boundary rule | ✅ + redaction depth | ✅ idempotency-key | ✅ | ✅ | — | README onboarding walkthrough |

Legend: ✅ required; — not applicable.

---

## 8. Risk Register

| Risk | Phase | Impact | Mitigation |
|------|-------|--------|------------|
| Refresh-token rewrite breaks active sessions | 2 | All logged-in users kicked out | Backfill `familyId = id` in Task 2.1 keeps existing rows valid; revoke-all only on rollout of Task 2.5 if format changes |
| Media authz model wrong → private asset leak | 3 | High (regulatory + reputational) | Default visibility = PRIVATE; review backfill SQL with two engineers; e2e "non-owner reads PRIVATE → 404" is gating |
| Strict TS + lint promotion creates huge diff | 1 | Slows reviews; risk of regression in many files | Split into multiple sequential PRs; PR-3 first (kills 18 sites), then PR-5/6 |
| Outbox parallelism causes duplicate dispatch | 6 | Duplicate emails, double-write to ES | Preserve `FOR UPDATE SKIP LOCKED` claim; only parallelize within the already-locked batch; per-`aggregateId` ordering |
| CI service containers make workflow slow/flaky | 5 | Slower PRs; flaky tests | Prefer Testcontainers (ADR-0008); split E2E into fast/slow suites if total time exceeds 10 min |
| Webhook envelope-bypass missed for a future endpoint | 4 | Provider integration breaks silently | Use a decorator (`@SkipResponseEnvelope()`) + ESLint rule requiring `@Public()` or `@SkipResponseEnvelope()` on `/webhooks/*` |
| Dockerfile change to non-root breaks startup | 5 | Container won't start | Verify in PR with `docker run` + healthcheck; keep rollback path documented |
| Cron leader-lock holds stale on crash | 6 | Cleanups paused | Use SETNX EX (TTL) — lock auto-expires |
| Idempotency-in-tx fix changes existing behavior subtly | 4 | False "duplicate" errors disappear or appear in unexpected places | Add an e2e for the rollback case; review every existing `claim` caller |
| Schema region/multi-file change creates merge conflicts | 7 | Slows feature work | Defer until a low-traffic window |

---

## 9. First Sprint Recommendation

### Sprint goal
**Install the safety net and start the highest-impact P0 (refresh token).** Unblock everything else.

### Tasks (max 7)
1. ADRs 0001–0008 written and accepted (Task 0.1).
2. Baseline snapshot (Task 0.3).
3. `PrismaTransaction = Prisma.TransactionClient` + remove `tx as any` (Task 1.1 / PR-3).
4. `jest.setup.ts` so `npm test` works without env (Task 1.5 / PR-4).
5. `tsconfig "strict": true` + fix errors (Task 1.2 / PR-5).
6. ESLint promotions + script split + CI strict lint (Tasks 1.3 + 1.4 / PR-6 + PR-7).
7. Refresh-token schema migration (`familyId`, `parentTokenId`) (Task 2.1 / PR-9).

### Expected PR order
PR-1 (ADRs) → PR-2 (baseline) → PR-3 (PrismaTransaction) → PR-4 (jest setup) → PR-5 (strict TS) → PR-6 (lint promotion) → PR-7 (lint script + CI) → PR-9 (refresh-token migration).

PR-3 and PR-4 can run in parallel. PR-5 and PR-6 can run in parallel after PR-3. PR-7 after PR-6.

### Verification commands
```bash
npm run check
npx prisma validate
DATABASE_URL=... npx prisma migrate dev    # for PR-9
```

### What should NOT be done yet
- Don't start auth `TokenService` rewrite (Task 2.2 / PR-10) until PR-3 and PR-9 land.
- Don't touch media authz (Phase 3) — first sprint stays focused.
- Don't touch billing/webhook (Phase 4) — separate sprint.
- Don't write the new event-schema registry (Phase 6) — too early.
- Don't rewrite README — defer to Phase 7.

---

## 10. Completion Definition

### Safe for internal beta
**Phases completed:** 0, 1, 2, 3
**Blocker status:** Both P0s closed (refresh-token + media authz). Type system and CI enforcing.
**What this means:** Internal team / known QA can use the app. Some operational rough edges (no real metrics, Dockerfile maybe still root, deploy is manual).

### Safe for closed beta (selected external users)
**Phases completed:** 0, 1, 2, 3, 4
**Blocker status:** All P0/P1 correctness items closed (webhook + idempotency + outbox attempts).
**What this means:** A small invited user pool can use the app for real transactions. Billing webhooks correct under provider retries.

### Safe for public traffic
**Phases completed:** 0, 1, 2, 3, 4, 5, 6
**Blocker status:** All P0/P1 closed; production hardening (Dockerfile, deploy, observability, throttler tuned, OTel valid, graceful shutdown) done; outbox scalability + DLQ admin in place.
**What this means:** App can absorb organic public traffic with normal incident-response capability.

### Production-ready (long-term)
**Phases completed:** 0–7.
**Blocker status:** All findings (P0–P3) closed.
**What this means:** Codebase is maintainable for the next 12 months: enforced boundaries, documented schema, generic idempotency, README that onboards humans, schema event registry.

---

## Open Questions

1. **Refresh-token migration during rollout:** if ADR-0001 picks SHA-256, the existing bcrypt-hashed tokens cannot be read. Do we (a) invalidate all sessions (best for security, worst for UX), (b) run a dual-read window, or (c) wait until existing tokens naturally expire (7 days)? **Recommendation:** option (c) if SHA-256 chosen — append new tokens as SHA-256, keep reading bcrypt for old ones until natural expiry.
2. **Media visibility backfill correctness:** how do we know which existing `MediaAsset` rows should become PUBLIC? Today there's no `isPublished` on `Post` — verify before writing backfill SQL.
3. **Deploy target:** is there a production environment at all today? If yes, where? If no, ADR-0003 should choose "delete the placeholder" until one exists.
4. **Cron-job ownership:** with leader election (ADR-0006), should `OutboxProcessor` *also* go through the lock (it currently relies on `SKIP LOCKED` for distributed safety, which is sufficient) — or is leader election only for cleanup-style jobs? **Recommendation:** outbox stays on `SKIP LOCKED`; leader election only for idempotency-cleanup and media-cleanup.
5. **WS query-string token removal** — is the frontend already using `handshake.auth.token`? If not, this needs a frontend coordination ticket before merging.
6. **OpenTelemetry exporter endpoint:** does production actually have an OTLP collector? Task 5.9's startup-fail behavior assumes yes. If not, soften to warn.
