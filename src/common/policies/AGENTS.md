<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common/policies

## Purpose

Authorization policy types and interfaces for NestJS. Provides a generic policy handler interface and policy context type for implementing authorization logic. Used by guards and services to check if a user has permission to access a resource.

## Key Files

| File | Description |
|------|-------------|
| `policy.types.ts` | `PolicyContext`: context for policy evaluation (user, resource); `PolicyHandler`: interface for policy implementations |
| `index.ts` | Barrel export: re-exports all public APIs |

## For AI Agents

### Working In This Directory

- **Policy context**: `PolicyContext<TResource>` is a generic type that holds the user and resource for policy evaluation. The resource type is generic to support any resource type.
- **Policy handler**: `PolicyHandler<TResource>` is an interface with a `canActivate()` method that returns a boolean or Promise<boolean>. Implement this interface to create custom policies.
- **User in context**: The `user` field is optional (`AuthenticatedUser | undefined`). Policies must handle the case where the user is not authenticated.
- **Resource in context**: The `resource` field is optional and generic. Policies can work with or without a resource.
- **Async policies**: The `canActivate()` method can be async (returns Promise<boolean>) for policies that need to fetch data or call external services.
- **Type safety**: Use the generic type parameter to ensure type safety: `PolicyHandler<User>` for user-specific policies, `PolicyHandler<Post>` for post-specific policies.

### Testing Requirements

- **Unit tests**: Test policy handlers with various contexts: authenticated user, unauthenticated user, different resources.
- **Test coverage**: Verify policies return true/false correctly, handle missing user/resource, and support async operations.
- **Run tests**: `npm test -- src/common/policies`
- **Coverage target**: Aim for >80% on new code.

### Common Patterns

- **Implementing a policy**: Create a class that implements `PolicyHandler<TResource>`:
  ```typescript
  export class IsOwnerPolicy implements PolicyHandler<Post> {
    canActivate(context: PolicyContext<Post>): boolean {
      if (!context.user || !context.resource) return false;
      return context.user.id === context.resource.ownerId;
    }
  }
  ```
- **Async policy**: Use async/await for policies that need to fetch data:
  ```typescript
  export class HasPermissionPolicy implements PolicyHandler<Post> {
    constructor(private permissionsService: PermissionsService) {}
    
    async canActivate(context: PolicyContext<Post>): Promise<boolean> {
      if (!context.user) return false;
      return this.permissionsService.hasPermission(
        context.user.id,
        'edit_post'
      );
    }
  }
  ```
- **Using policies in guards**: Inject policy handlers into guards and call `canActivate()`:
  ```typescript
  @Injectable()
  export class OwnerGuard implements CanActivate {
    constructor(private isOwnerPolicy: IsOwnerPolicy) {}
    
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const resource = request.resource; // populated by middleware
      return this.isOwnerPolicy.canActivate({
        user: request.user,
        resource
      });
    }
  }
  ```
- **Composing policies**: Combine multiple policies with AND/OR logic:
  ```typescript
  const canEdit = (
    await isOwnerPolicy.canActivate(context) ||
    (await isAdminPolicy.canActivate(context))
  );
  ```

## Dependencies

### Internal

- **auth/**: `AuthenticatedUser` is used in `PolicyContext` to represent the authenticated user.
- **errors/**: Policies typically throw `ForbiddenException` when authorization fails.

### External

- None (types only).
