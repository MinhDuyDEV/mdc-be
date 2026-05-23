<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# billing/

## Purpose

Billing and subscription management module handling premium features, seat-based pricing, credit systems, and payment processing. Implements entitlement checks, usage tracking, and webhook handling for payment providers.

## Key Files

| File | Description |
|------|-------------|
| `billing.module.ts` | NestJS module configuration with BillingController and BillingService |
| `billing.controller.ts` | HTTP endpoints for subscription management and billing operations |
| `billing.service.ts` | Business logic for subscriptions, credits, and entitlements |
| `billing.service.spec.ts` | Unit tests for BillingService |
| `billing.constants.ts` | Constants for plan limits, pricing, and feature flags |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for billing request/response payloads |
| `entitlements/` | Entitlement checking logic for feature access control |
| `ports/` | Port interfaces for payment provider abstraction |
| `webhooks/` | Webhook handlers for payment provider events |

## For AI Agents

### Working In This Directory

- **Atomic operations** — Use database transactions for credit deductions and seat allocations
- **Idempotency** — All billing operations must be idempotent (use idempotency keys)
- **Entitlement checks** — Verify feature access before allowing operations
- **Webhook security** — Validate webhook signatures from payment providers
- **Audit trail** — Log all billing events for compliance and debugging
- **Credit atomicity** — Ensure credit balance never goes negative

### Testing Requirements

```bash
# Unit tests
npm test -- billing.service.spec.ts

# E2E tests
npm run test:e2e -- billing.e2e-spec.ts
```

### Common Patterns

**Entitlement Check:**
```typescript
@Get('features/:feature')
async checkEntitlement(
  @CurrentUser() user: User,
  @Param('feature') feature: string,
) {
  const hasAccess = await this.billingService.hasEntitlement(
    user.organizationId,
    feature,
  );
  return { data: { hasAccess } };
}
```

**Credit Deduction (Atomic):**
```typescript
async deductCredits(orgId: string, amount: number): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { creditBalance: true },
    });
    
    if (org.creditBalance < amount) {
      throw new InsufficientCreditsException();
    }
    
    await tx.organization.update({
      where: { id: orgId },
      data: { creditBalance: { decrement: amount } },
    });
  });
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and organization context
- `src/common/` — Response formatting, error handling, validation
- `src/infra/prisma/` — Database access with transactions
- `src/outbox/` — Event publishing for billing events

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
