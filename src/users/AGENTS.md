<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# users

## Purpose
User profile management providing authenticated user profile retrieval and updates, plus public profile access. Handles own-profile operations and public profile visibility filtering.

## Key Files
| File | Description |
|------|-------------|
| `users.module.ts` | Module configuration importing InfraModule |
| `users.controller.ts` | REST endpoints for GET /users/me, PATCH /users/me, GET /users/:id |
| `users.service.ts` | User profile business logic with Prisma queries |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dto/` | User profile DTOs (UpdateProfileDto) |

## For AI Agents

### Working In This Directory
- **Own Profile Operations**: Use `@CurrentUser()` decorator to extract authenticated user, `getOwnProfile()` returns full profile including email and emailVerifiedAt, `updateOwnProfile()` allows updating displayName only
- **Public Profile Access**: `getPublicProfile()` filters out DELETED and DISABLED users, excludes email and emailVerifiedAt, returns minimal fields (id, displayName, createdAt)
- **Field Selection Pattern**: Own profile (id, email, displayName, emailVerifiedAt, status, createdAt), Public profile (id, displayName, createdAt), never expose password or tokens
- **Error Handling**: Throw `NotFoundException` for missing or inaccessible users

### Testing Requirements
- Test own profile retrieval with authenticated user
- Test own profile update with valid displayName
- Test public profile returns minimal fields
- Test public profile throws NotFoundException for DELETED users
- Test public profile throws NotFoundException for DISABLED users
- Test public profile throws NotFoundException for non-existent users
- Mock PrismaService for unit tests

### Common Patterns
```typescript
// Own profile retrieval
@Get('me')
async getMe(@CurrentUser() user: AuthenticatedUser) {
  return this.usersService.getOwnProfile(user);
}

// Own profile update
@Patch('me')
async updateMe(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: UpdateProfileDto,
) {
  return this.usersService.updateOwnProfile(user, dto);
}

// Public profile access
@Get(':id')
async getUser(@Param('id') id: string) {
  return this.usersService.getPublicProfile(id);
}
```

## Dependencies

### Internal
- `../infra/prisma` - Database access for user records
- `../common/auth` - CurrentUser decorator and AuthenticatedUser interface

### External
- `@nestjs/common` - NestJS core decorators and exceptions
