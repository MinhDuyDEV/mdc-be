<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Billing Entitlements

## Purpose
Feature access control based on subscription plans. Provides guards and decorators to enforce plan-based entitlements at the route level.

## Key Files
| File | Description |
|------|-------------|
| entitlements.service.ts | Core service for checking feature access based on subscription status |
| entitlements.guard.ts | NestJS guard that enforces entitlement checks on protected routes |
| require-entitlement.decorator.ts | Decorator to mark routes with required entitlements (e.g., `@RequireEntitlement('advanced_search')`) |

## Subdirectories
None

## For AI Agents

### Working In This Directory
- Entitlements are feature flags tied to subscription plans (e.g., 'advanced_search', 'bulk_messaging')
- The guard reads metadata from `@RequireEntitlement()` and checks user's active subscription
- Service methods return boolean for feature access and throw exceptions for unauthorized access
- Entitlements are cached per request to avoid repeated database queries
- Seat limits are enforced separately (see `allocate-recruiter-seat.dto.ts`)

### Testing Requirements
- Test entitlement checks for users with/without active subscriptions
- Test guard behavior on routes with/without `@RequireEntitlement()` decorator
- Test caching behavior (multiple checks in same request should use cache)
- Verify proper error messages for missing entitlements
- Run tests: `npm test -- src/billing/entitlements`

### Common Patterns
- Decorator usage: `@RequireEntitlement('feature_name') @Get('premium-feature')`
- Service check: `await entitlementsService.hasEntitlement(userId, 'feature_name')`
- Guard application: `@UseGuards(EntitlementsGuard)` on controller or route
- Error handling: Throws `ForbiddenException` with upgrade message

## Dependencies

### Internal
- `../billing.service.ts` — Fetches subscription data
- `../../common/auth/current-user.decorator.ts` — Extracts user from request
- `../../common/errors/` — Exception types for unauthorized access

### External
- `@nestjs/common` — Guard, decorator, and exception utilities
- `@prisma/client` — Subscription and plan data models

<!-- MANUAL: -->
