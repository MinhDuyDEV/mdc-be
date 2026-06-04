<!-- Parent: ../AGENTS.md -->

# Billing Domain

## Purpose

Subscription and entitlement management for the platform. Handles billing plans, company subscriptions, invoices, entitlement grants, and webhook processing for payment provider integration.

## Key Files

- **billing.module.ts** - Module definition importing InfraModule and OutboxCoreModule, exporting BillingService and EntitlementsService
- **billing.controller.ts** - REST controller with public plan routes and company-scoped subscription/invoice routes
- **billing.service.ts** - Core billing logic for plans, subscriptions, invoices, and entitlement grants
- **billing.constants.ts** - Feature key to entitlement type mapping (`FEATURE_KEY_TO_ENTITLEMENT`)
- **entitlements/** - Entitlement checking service and guard for feature access control
- **webhooks/** - Webhook controller, service, and signature verification guard
- **ports/** - Port interfaces for external payment provider integration
- **dto/** - Request/response DTOs for billing operations

## Subdirectories

- **dto/** - Data transfer objects for plans, subscriptions, invoices
- **entitlements/** - Entitlement service, guard, and decorator for feature access control
- **webhooks/** - Webhook handling for payment provider events
- **ports/** - Port interfaces for payment provider abstraction

## For AI Agents

### Working Instructions

1. **Billing Plans**:
   - Plans define features as JSON object: `{ [featureKey: string]: number }`
   - Feature values must be non-negative numbers (validated at runtime)
   - Plans have `isPublic` and `isActive` flags
   - Admin-only routes for creating/updating plans
   - Public routes for listing/viewing plans (filtered for non-admins)

2. **Subscription Creation**:
   - Requires email verification (`user.emailVerifiedAt` must be set)
   - One subscription per company (throw 409 if exists)
   - Idempotency key: `${companyId}:${planId}`
   - Initial status: `trialing` with 1-month period
   - Automatically grants entitlements from plan features
   - Emits `SubscriptionCreated` outbox event

3. **Entitlement Grants**:
   - Created from plan features during subscription creation
   - Maps feature keys to `CompanyEntitlement` types via `FEATURE_KEY_TO_ENTITLEMENT`
   - Each grant has `validFrom` and `validUntil` timestamps
   - Upserts `CompanyEntitlement` records with `creditsTotal` and `creditsRemaining`
   - Feature values must be non-negative finite numbers

4. **Entitlement Checking** (`entitlements/`):
   - `EntitlementsService.checkEntitlement()` verifies company has active entitlement with remaining credits
   - `EntitlementsGuard` + `@RequireEntitlement()` decorator for route-level enforcement
   - Returns 403 with specific error codes: `ENTITLEMENT_NOT_FOUND`, `ENTITLEMENT_EXPIRED`, `ENTITLEMENT_EXHAUSTED`
   - Checks: entitlement exists, `validFrom <= now < validUntil`, `creditsRemaining > 0`

5. **Subscription Management**:
   - Get subscription: returns subscription + plan details
   - Cancel subscription: sets `cancelAtPeriodEnd = true` and `canceledAt = now`
   - Emits `SubscriptionCancelled` outbox event

6. **Invoices**:
   - List invoices with cursor-based pagination
   - Get invoice with line items
   - Scoped to company (verify `invoice.companyId === companyId`)

7. **Webhooks** (`webhooks/`):
   - `WebhookController` receives payment provider callbacks
   - `WebhookSignatureGuard` verifies webhook signatures
   - `WebhookService` processes events
   - Webhook routes are public but signature-verified

8. **Authorization**:
   - Plan listing: optional auth (admins see all, others see public only)
   - Plan viewing: public
   - Plan creation/update: admin-only
   - Subscription creation: company OWNER + email verified
   - Subscription viewing: company OWNER, ADMIN, or BILLING_ADMIN
   - Subscription cancellation: company OWNER only
   - Invoice viewing: company OWNER, ADMIN, or BILLING_ADMIN

### Testing Requirements

- Mock `PrismaService`, `OutboxService`, `IdempotencyService`
- Test plan CRUD
- Test subscription creation (email verification check, duplicate prevention, entitlement grants)
- Test entitlement grant creation (feature key mapping, credit initialization)
- Test entitlement checking (not found, expired, exhausted)
- Test subscription cancellation
- Test invoice pagination
- Test webhook signature verification
- Test authorization guards

### Common Patterns

- **Feature Validation**: Runtime validation of feature values (non-negative finite numbers)
- **Entitlement Mapping**: Use `FEATURE_KEY_TO_ENTITLEMENT` to map plan features to entitlement types
- **Idempotency**: Prevent duplicate subscriptions with idempotency keys
- **Cursor Pagination**: Use `(createdAt, id)` composite cursor for invoices
- **Outbox Events**: Emit events for subscription lifecycle
- **Transactional Grants**: Create subscription + entitlement grants in single transaction

## Dependencies

### Internal (Allowed by eslint.config.mjs)

- **outbox** - OutboxService for event emission, IdempotencyService for duplicate prevention

### External

- **@nestjs/common** - Controller, service, guards, decorators
- **@prisma/client** - Prisma types for billing entities
- **infra** - PrismaService for database access

## Notes

- One subscription per company (enforced by unique constraint)
- Entitlements are automatically granted from plan features during subscription creation
- Feature keys in plan.features must map to valid entitlement types
- Subscription status starts as `trialing` with 1-month period
- Cancellation sets `cancelAtPeriodEnd` flag (subscription remains active until period end)
- Webhook signature verification is critical for security
- Entitlement checks are time-aware (validFrom/validUntil) and credit-aware (creditsRemaining)
- Invoice pagination uses cursor-based approach for efficient large-dataset handling
