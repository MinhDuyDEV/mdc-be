<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# src/types

## Purpose

Shared TypeScript type definitions and ambient declarations extending third-party libraries. Provides type safety for Express request augmentation and other global type extensions.

## Key Files

| File | Description |
|------|-------------|
| `express.d.ts` | Global Express type augmentation; extends `Express.Request` with optional `user?: AuthenticatedUser` property for authenticated request context |

## For AI Agents

### Working In This Directory

- **Express Type Augmentation**: `express.d.ts` extends `Express.Request` to include optional `user` property, type: `AuthenticatedUser` from `../common/auth/current-user.interface`, enables type-safe access to `req.user` in middleware and guards
- **Adding New Type Declarations**: Create `.d.ts` files for ambient declarations, use `declare global` for global namespace augmentation, use `declare module` for module augmentation, import types from source modules, never duplicate type definitions
- **Type Safety Pattern**: Never use `any` in type declarations, use `unknown` for truly unknown types, use optional properties (`?`) for nullable fields, use union types for discriminated unions

### Testing Requirements

- No runtime tests needed (declaration files only)
- Verify TypeScript compilation succeeds
- Verify type inference works in consuming code
- Use `tsc --noEmit` to validate type declarations

### Common Patterns

```typescript
// Express Request augmentation
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Module augmentation
declare module 'third-party-lib' {
  export interface ExistingInterface {
    newProperty: string;
  }
}

// Global type declaration
declare global {
  type CustomGlobalType = {
    id: string;
    name: string;
  };
}
```

## Dependencies

### Internal

- **common/auth/current-user.interface**: Defines `AuthenticatedUser` interface used in Express.Request augmentation.

### External

- **@types/express**: Express type definitions; provides base Request, Response, NextFunction types.
- **@types/node**: Node.js type definitions; provides global types.
- **typescript**: TypeScript compiler; validates type definitions.
