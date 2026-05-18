# mdc-be — Project Knowledge Base

**Generated:** 2026-05-16
**Branch:** main | **Commit:** c78db53

## OVERVIEW

NestJS 11 backend API. TypeScript with decorators, Jest testing, ESLint + Prettier.

## STRUCTURE

```
mdc-be/
├── src/
│   ├── main.ts          # Bootstrap, listens on PORT || 3000
│   ├── app.module.ts    # Root module
│   ├── app.controller.ts # HTTP routes
│   └── app.service.ts   # Business logic
├── test/                # E2E tests (jest-e2e.json)
└── dist/                # Build output (gitignored)
```

## COMMANDS

```bash
npm run build          # nest build → dist/
npm run start:dev      # nest start --watch
npm run start:prod     # node dist/main
npm test               # jest (unit)
npm run test:e2e       # jest --config test/jest-e2e.json
npm run lint           # eslint --fix
npm run format         # prettier --write
```

## CODE NAVIGATION

**srcwalk** (v0.5.0) — Tree-sitter indexed code navigation for AI agents

```bash
# Essential commands
srcwalk guide                    # Full agent guide (must read first)
srcwalk <path>                   # Smart file read
srcwalk <path>:<line>            # Read around specific line
srcwalk find <query>             # Find definitions/usages/text
srcwalk files <glob>             # Find files by pattern
srcwalk callers <symbol>         # Show who calls a symbol
srcwalk callees <symbol>         # Show what a symbol calls
srcwalk deps <file>              # Analyze imports and dependents
srcwalk map                      # Repo structure and dependency groups
srcwalk flow <symbol>            # Compact caller/callee slice
srcwalk impact <symbol>          # Blast-radius triage

# Options
--scope <dir>                    # Search within directory
--budget <tokens>                # Max tokens (default: 5000)
--no-budget                      # Disable token limit
```

**When to use srcwalk:**

- Before editing unfamiliar code — understand structure first
- Finding symbol definitions and usages across the codebase
- Tracing dependencies and impact analysis
- Generating repo maps for context

## CONVENTIONS

- Decorators: `emitDecoratorMetadata` + `experimentalDecorators` enabled in tsconfig
- Module resolution: `nodenext` — use `.js` extensions in relative imports if needed
- Tests: colocated `*.spec.ts` in `src/`, e2e in `test/`
- Target: ES2023, strictNullChecks on, noImplicitAny off

## ANTI-PATTERNS

- Never edit `dist/` directly — it's rebuilt on every `npm run build`
- Don't commit `.env` or secrets
- Don't use `npm run lint` without `--fix` in CI (it auto-fixes)

## GOTCHAS

- `main.ts` bootstrap promise is not awaited — ESLint warns `@typescript-eslint/no-floating-promises`
- `noImplicitAny: false` — missing types silently become `any`
- `strictBindCallApply: false` — `.call`/`.apply` not strictly typed
