# Complete Audit + Optimization Plan

## Objective

Complete all applicable work from:

- `AUDIT_REPORT.md`
- `OPTIMIZATION_PLAN.md`

Work phase-by-phase until all audit/optimization items are implemented, verified, documented, or explicitly blocked by a real decision/environment constraint.

Priority order:

1. Phase 0 — planning/baseline/ADR if needed
2. Phase 1 — type safety, CI, local test reliability
3. Phase 2 — refresh-token security
4. Phase 3 — media authorization
5. Phase 4 — webhook/idempotency/outbox correctness
6. Phase 5 — runtime/observability/production guardrails
7. Phase 6 — outbox scalability/operational tooling
8. Phase 7 — maintainability/docs/architecture

## Constraints

- Read `AUDIT_REPORT.md`, `OPTIMIZATION_PLAN.md`, `AGENTS.md`, and relevant subdirectory `AGENTS.md` before edits.
- Preserve existing NestJS modular-monolith architecture.
- Make smallest correct changes.
- Do not edit `dist/`.
- Do not commit secrets or `.env`.
- Ask before adding dependencies.
- Ask before schema-shape decisions where plan gives multiple options and no ADR exists.
- Ask before committing, pushing, closing beads, or irreversible operations.
- Do not weaken lint/type/schema safety to make checks pass.
- Do not use `as any`, `@ts-ignore`, disabled rules, or fake stubs unless narrowly justified and documented.

## Execution Rules

For each phase:

1. Read relevant plan section and audit findings.
2. Inspect current code before editing.
3. Identify dependencies and safe parallel work.
4. Implement focused changes only.
5. Add regression tests for security/correctness bugs.
6. Run targeted verification after each meaningful change.
7. Run phase verification before moving on.

Use TDD for risky fixes where practical:

1. Add failing regression test.
2. Confirm failure.
3. Implement fix.
4. Confirm pass.
5. Run broader gates.

## Required Fix Themes

### Phase 1 Safety Net

- Fix `PrismaTransaction` to `Prisma.TransactionClient`.
- Remove production `tx as any`.
- Remove outbox runtime guard caused by bad tx typing.
- Enable stronger TypeScript/lint safety where feasible.
- Split `lint` verification from `lint:fix`.
- CI must not run `eslint --fix`.
- `npm test` must work without manual env exports.
- Add/update `check` script if useful.

### Auth Refresh Token

- Refresh lookup must use presented token identity, not latest by `userId`.
- Multi-device refresh must not conflict.
- Reuse detection must revoke affected family/session only.
- `/auth/refresh` must not require Bearer access token.
- Do not trust `jwtService.decode()` for refresh identity.
- Cookie config must use `ConfigService`, not raw `process.env`.
- Use or remove dead refresh-token env config per chosen design.
- Add unit/e2e tests for two-device refresh, replay, expired/revoked token, cookie-only refresh.

### Media Authorization

- Public assets such as avatars/post images/company logos must be readable by intended public/anonymous users.
- Private assets must remain owner/authorized-only.
- Private denial must avoid enumeration per existing style.
- Confirm/delete must remain owner-only or stricter.
- Add tests for public read and private denial.

### Webhook / Idempotency / Outbox

- Idempotency claim must participate in caller transaction where needed.
- Rollback must not leave committed idempotency claim.
- Webhook signature guard must hard-fail when raw body missing.
- Remove `JSON.stringify(request.body)` raw-body fallback.
- Webhook provider response must bypass response envelope where required.
- Outbox attempts must count actual failures, not claims.
- Add regression tests.

### Runtime / Production Guardrails

Address applicable audit findings:

- Dockerfile non-root, no duplicate install, healthcheck.
- Request ID consistent across response, logs, error envelope.
- Non-HttpException 500s logged with stack/requestId.
- Global throttler sane default.
- WebSocket token not accepted via query string.
- OTel production config validation and clean shutdown.
- Outbox lock release on shutdown if implemented.
- Helmet minimal CSP.
- CI e2e infra/Testcontainers if safe.
- Security workflow expansion if feasible.

### Outbox / Maintainability

Implement where safe:

- Event schema/typed registry.
- Bounded parallel dispatch with ordering constraints.
- Outbox metrics.
- Cron leader election/jitter.
- DLQ admin/runbook with strong auth/audit.
- Prisma pool/transaction timeout docs/config.
- Slug helper consolidation.
- Docs/runbooks/README updates.

## Verification

Never claim complete without fresh evidence.

Before final completion run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
```

If schema changed:

```bash
npx prisma generate
npx prisma validate
```

If e2e infra available:

```bash
docker-compose up -d
npm run test:e2e
```

If Dockerfile changed:

```bash
docker build -t mdc-be:test .
```

Also run targeted checks:

```bash
grep -R "tx as any" src --include="*.ts" || true
grep -R "process.env" src/auth --include="*.ts" || true
grep -R "handshake.query.token" src --include="*.ts" || true
grep -R "JSON.stringify(request.body)" src --include="*.ts" || true
```

Expected final state:

- No production `tx as any`.
- No auth cookie config from raw `process.env`.
- No query-string WebSocket token fallback.
- No webhook raw-body stringify fallback.
- Typecheck/lint/test/build/prisma validation pass, or exact blocker documented.

## Reporting

After each phase report:

```md
## Phase N Result

Changed:
- file:line — what changed and why

Verification:
- command — result summary

Remaining:
- none / exact blocker
```

Final report:

```md
## Final Result

Completed:
- Phase 0 ...
- Phase 1 ...
...

Verification:
- `npm run typecheck`: pass/fail
- `npm run lint`: pass/fail
- `npm test`: pass/fail + counts
- `npm run build`: pass/fail
- `npx prisma validate`: pass/fail
- `npm run test:e2e`: pass/fail/skipped + reason
- `docker build -t mdc-be:test .`: pass/fail/skipped + reason

Known blockers:
- none / exact blockers

Next recommended action:
- commit/PR instructions, but do not commit or push unless user approves.
```

## Done Criteria

Done only when:

- Every applicable task in `OPTIMIZATION_PLAN.md` is done or explicitly blocked.
- All P0/P1 audit findings are fixed with tests.
- Verification has fresh evidence.
- Docs/runbooks updated for operational changes.
- No unapproved dependency, secret, commit, push, schema decision, or unrelated refactor introduced.
