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
