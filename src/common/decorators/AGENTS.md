<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# decorators

## Purpose
Provides NestJS decorators for route-level authorization and metadata attachment. Currently exports the `@CompanyRole()` decorator, which marks route handlers as requiring specific company membership roles (OWNER, ADMIN, MEMBER). Works in tandem with `CompanyRoleGuard` to enforce hierarchical role-based access control.

## Key Files
| File | Description |
|------|-------------|
| `company-role.decorator.ts` | Defines `@CompanyRole()` decorator and `COMPANY_ROLE_METADATA_KEY` symbol for marking routes with required company roles |
| `index.ts` | Public exports |

## For AI Agents

### Working In This Directory
- Decorators are metadata markers; they do not perform authorization logic themselves.
- The `@CompanyRole()` decorator accepts a variadic list of role names (e.g., `@CompanyRole('OWNER', 'ADMIN')`).
- Metadata is read by `CompanyRoleGuard` at runtime to enforce access control.
- Always pair decorator usage with `@UseGuards(CompanyRoleGuard)` on the controller or route handler.
- Role names must match the Prisma `CompanyRole` enum (OWNER, ADMIN, MEMBER).

### Testing Requirements
- Unit tests should verify that `@CompanyRole()` correctly attaches metadata to route handlers.
- Use NestJS `Reflector` to read metadata in tests and confirm the decorator sets the expected role list.
- Integration tests should verify that routes decorated with `@CompanyRole()` are protected by `CompanyRoleGuard`.

### Common Patterns
- Decorator applied at method level: `@CompanyRole('OWNER') @Patch(':id') updateCompany(...) {}`
- Decorator applied at class level to protect all routes: `@CompanyRole('ADMIN') @Controller('companies')`
- Multiple roles indicate "any of these roles": `@CompanyRole('OWNER', 'ADMIN')` means OWNER OR ADMIN.

## Dependencies

### Internal
- `../guards/company-role.guard.ts` — Guard that reads this decorator's metadata and enforces role checks.
- `../auth/current-user.interface.ts` — User context passed through the request.

### External
- `@nestjs/common` — `SetMetadata` for attaching metadata to route handlers.
- `@prisma/client` — `CompanyRole` enum for type-safe role names.
