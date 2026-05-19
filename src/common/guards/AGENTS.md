<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# guards

## Purpose
Implements NestJS guards for route-level authorization and access control. Includes `CompanyRoleGuard` for hierarchical company membership validation and `PolicyGuard` as a placeholder for future policy-based authorization. Guards are applied to controllers or route handlers to enforce security rules before handler execution.

## Key Files
| File | Description |
|------|-------------|
| `company-role.guard.ts` | Validates user company membership and role hierarchy (OWNER > ADMIN > MEMBER); reads `@CompanyRole()` metadata and checks Prisma database |
| `policy.guard.ts` | Placeholder guard for policy-based authorization; currently always returns `true` pending Phase 0A completion |
| `index.ts` | Public exports |

## For AI Agents

### Working In This Directory
- Guards implement NestJS `CanActivate` interface and are applied via `@UseGuards()` decorator.
- `CompanyRoleGuard` is stateful: it reads metadata, queries the database, and throws exceptions on authorization failure.
- Role hierarchy is defined in `COMPANY_ROLE_LEVEL`: OWNER (3) > ADMIN (2) > MEMBER (1). A user with a higher-level role satisfies guards requiring lower-level roles.
- `CompanyRoleGuard` resolves `companyId` from route params (`companyId` or `id`); ensure routes provide one of these.
- `PolicyGuard` is a stub; do not rely on it for actual authorization until Phase 0A completes.
- Guards throw `ForbiddenException` for authorization failures and `NotFoundException` if the company does not exist.

### Testing Requirements
- Unit tests for `CompanyRoleGuard` should mock `Reflector`, `PrismaService`, and `ExecutionContext`.
- Test all role hierarchy scenarios: OWNER satisfies ADMIN/MEMBER, ADMIN satisfies MEMBER, MEMBER does not satisfy ADMIN/OWNER.
- Test edge cases: missing user, missing company, inactive membership, missing `companyId` param.
- Integration tests should verify guards work with actual controllers and database queries.
- `PolicyGuard` tests should verify it always returns `true` in Phase 0A.

### Common Patterns
- Apply guard at controller level: `@UseGuards(CompanyRoleGuard) @Controller('companies')`
- Apply guard at method level: `@UseGuards(CompanyRoleGuard) @Patch(':id')`
- Combine with decorator: `@UseGuards(CompanyRoleGuard) @CompanyRole('OWNER') @Patch(':id')`
- Guard reads metadata from both handler and class; class-level metadata is inherited by all methods.

## Dependencies

### Internal
- `../decorators/company-role.decorator.ts` — Provides `COMPANY_ROLE_METADATA_KEY` and `CompanyRoleName` type.
- `../auth/current-user.interface.ts` — Defines `AuthenticatedUser` interface for request user context.
- `../../infra/prisma/prisma.service.ts` — Database access for company and membership queries.

### External
- `@nestjs/common` — `CanActivate`, `ExecutionContext`, `ForbiddenException`, `NotFoundException`, `Injectable`.
- `@nestjs/core` — `Reflector` for reading route metadata.
- `@prisma/client` — `CompanyRole` enum and Prisma client types.
