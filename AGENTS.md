# mdc-be — Project Knowledge Base

**Updated:** 2026-05-19 | **Branch:** main

NestJS 11 backend for a LinkedIn-like job social network. Modular monolith with explicit domain boundaries (auth, users, profiles, companies, media, search, email, outbox).

## STACK

- **NestJS** 11.0.1 + **TypeScript** 5.7.3 (ESNext, decorators), **Node** ≥20.19.0
- **Prisma** 6.19.3 + **Postgres** 16 (durable source of truth)
- **Redis** 7 via **ioredis** 5.10 (cache, rate limits, presence)
- **S3** via `@aws-sdk/client-s3` (MinIO dev / AWS prod) — `STORAGE_CLIENT` token
- **Elasticsearch** 8.17 — `SEARCH_ENGINE_CLIENT` token
- **Email** via Nodemailer 8 — `MAILER_TRANSPORTER` token
- **Logging** nestjs-pino 4.6, **OTel** auto-instrumentations + OTLP HTTP exporters
- **Validation** class-validator + class-transformer (whitelist + transform pipe)
- **Tests** Jest 30 (unit colocated `*.spec.ts`, e2e in `test/`)

## STRUCTURE

```
src/
├── main.ts              # bootstrap, global pipes, /api/v1 prefix
├── app.module.ts        # root module
├── infra/               # config, prisma, redis, s3, search, mailer, health, otel
├── common/              # guards, decorators, filters, pagination, error contracts
├── outbox/              # transactional events: lease, retry, dead-letter, idempotency
├── auth/ users/ profiles/ companies/ media/ search/ email/   # domain modules
└── types/
prisma/schema.prisma     # data model + migrations
test/                    # *.e2e-spec.ts (jest-e2e.json)
```

## COMMANDS (validated)

```bash
npm run build              # nest build → dist/
npm run start:dev          # nest --watch (with OTel + ts-node)
npm run typecheck          # tsc --noEmit
npm run lint               # eslint --fix  (auto-fix; do NOT use as CI gate)
npm run format             # prettier --write
npm test                   # jest unit
npm run test:e2e           # test/jest-e2e.json
npm run prisma:validate    # validate schema
npm run prisma:generate    # regen client
npm run prisma:migrate     # dev migrate
```

## CONVENTIONS

- API prefix `/api/v1`. Success: `{ data, meta? }`. Error: `{ error: { code, message, details?, requestId? } }`.
- Custom DI tokens for infra clients: `REDIS_CLIENT`, `STORAGE_CLIENT`, `SEARCH_ENGINE_CLIENT`, `MAILER_TRANSPORTER`.
- `APP_PROCESS_ROLE=api|worker|realtime|all` controls runtime role behavior.
- Cross-domain side effects flow through the **outbox** (`SELECT … FOR UPDATE SKIP LOCKED`, leasing with `OUTBOX_LEASE_TIMEOUT_MS`, exponential backoff capped at `OUTBOX_MAX_BACKOFF_MS`, dead-letter + idempotency).
- TS flags: `strict`, `strictNullChecks: true`, `noImplicitAny: true`, `strictBindCallApply: true`, `module: nodenext`.
- Tests: colocated `*.spec.ts`; e2e under `test/` using supertest.

## CODE NAVIGATION

**ALWAYS use `srcwalk` first.** It is the primary code navigator (tree-sitter based). Fall back to `grep`/`find`/`fd` ONLY when srcwalk fails or cannot answer the question.

Run `srcwalk guide` to see the full routing policy.

### Core commands

```bash
srcwalk map --scope <dir>              # repo structure + dependency groups
srcwalk find <symbol|text> --scope <dir>  # definitions + usages
srcwalk find '*Pattern*' --scope <dir> --filter kind:fn  # symbol globs
srcwalk files '<glob>' --scope <dir>   # file discovery by name/glob
srcwalk callers <symbol> --scope <dir> # who calls it
srcwalk callees <symbol> --scope <dir> # what it calls
srcwalk deps <file>                    # imports + dependents
srcwalk flow <symbol> --scope <dir>    # bidirectional slice
srcwalk impact <symbol> --scope <dir>  # blast-radius before change
srcwalk <path>[:line]                  # smart token-aware read
```

### Fallback rules

- **shell `find`/`fd`**: ONLY for filesystem metadata (permissions, mtimes, empty dirs, symlinks, binary assets, generated outputs). Never for code discovery.
- **raw `grep`**: ONLY for last-mile text confirmation after `srcwalk find` has narrowed scope.
- **shell `tree`/`ls`**: NEVER for orientation — use `srcwalk map` instead.

## BOUNDARIES

**Always**

- Run `npm run lint` (auto-fix) and `npm run typecheck` before claiming done.
- Run `npx prisma validate` after editing `prisma/schema.prisma`.
- Use the outbox for cross-domain side effects; never fan out inline.

**Ask first**

- Adding a new dependency to `package.json`.
- Schema changes (`prisma/schema.prisma`, Zod schemas, config shape).
- New `prisma migrate` runs that alter prod-bound tables.
- Modifying `.opencode/` structure or this file.

**Never**

- Edit `dist/` (rebuilt on `npm run build`).
- Commit `.env` or secrets.
- Force-push `main`. Bypass git hooks.
- Log secrets, tokens, resumes, full message bodies, or private raw bodies.

## GOTCHAS

- `bodyParser: false` in `NestFactory.create()` — custom body parsers wired in `bootstrap.ts`. Don't re-enable globally.
- `@nestjs/schedule` is **^6** (not 4) — peer-dep conflict with NestJS 11 if downgraded.
- `@nestjs/config` uses hand-written `validateEnv()`; Zod 4.x is installed but not yet wired for env validation.
- OTel setup is `--require ./src/instrumentation.ts` for dev / `./dist/instrumentation.js` for prod — must load before Nest.
- `main.ts` bootstrap promise is intentionally not awaited (`@typescript-eslint/no-floating-promises` will warn).
- Module resolution is `nodenext` — relative ESM imports may need `.js` extensions.
- `npm run lint` mutates files (`--fix`); CI should use a non-fix command instead.

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
