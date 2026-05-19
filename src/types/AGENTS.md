<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# src/types

## Purpose

TypeScript type definitions and global type augmentations for the NestJS backend. Provides type safety across the application by declaring custom interfaces, extending third-party types (Express, NestJS), and defining shared type contracts used throughout the codebase.

## Key Files

| File | Description |
|------|-------------|
| `express.d.ts` | Global Express type augmentation; extends `Express.Request` with optional `user?: AuthenticatedUser` property for authenticated request context |

## For AI Agents

### Working In This Directory

- **Type augmentation**: Use `.d.ts` files to extend third-party types (Express, NestJS, etc.) without modifying node_modules.
- **Global scope**: Types declared here are available globally; no imports needed in consuming files.
- **AuthenticatedUser interface**: Imported from `../common/auth/current-user.interface`; represents the authenticated user attached to requests by auth middleware.
- **Naming convention**: Use `.d.ts` extension for type-only files; use `.ts` for files with runtime code.
- **No runtime code**: Keep this directory for type definitions only; do not add services, utilities, or business logic here.

### Testing Requirements

- **Type checking**: Run `npm run type-check` or `tsc --noEmit` to verify type definitions compile without errors.
- **No unit tests**: Type definition files do not require unit tests; type safety is verified at compile time.
- **Integration**: Verify types are correctly applied in consuming modules (auth middleware, controllers, services).

### Common Patterns

- **Global augmentation**: Use `declare global { namespace ... }` to extend existing types.
- **Interface extension**: Extend Express.Request, Response, or other third-party interfaces to add custom properties.
- **Import paths**: Use relative imports (`../common/auth/...`) to reference interfaces from other modules.
- **Strict typing**: Avoid `any` types; use `unknown` or specific types instead.

## Dependencies

### Internal

- **common/auth/current-user.interface**: Defines `AuthenticatedUser` interface used in Express.Request augmentation.

### External

- **@types/express**: Express type definitions; provides base Request, Response, NextFunction types.
- **@types/node**: Node.js type definitions; provides global types.
- **typescript**: TypeScript compiler; validates type definitions.
