<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Billing DTOs

## Purpose
Data transfer objects for subscription management, plan configuration, and invoice operations. Validates billing-related requests and structures financial data responses.

## Key Files
| File | Description |
|------|-------------|
| create-plan.dto.ts | Validates plan creation (name, price, features, seat limits) |
| update-plan.dto.ts | Validates plan updates with partial field support |
| create-subscription.dto.ts | Validates subscription creation (plan ID, payment method, billing cycle) |
| subscription.response.dto.ts | Response structure for subscription data with plan details and status |
| invoice.response.dto.ts | Response structure for invoice data with line items and payment status |
| list-invoices.dto.ts | Query parameters for invoice listing with date range and status filters |

## For AI Agents

### Working In This Directory
- Plan DTOs validate pricing (must be positive integers in cents), seat limits, and feature flags
- Subscription DTOs enforce plan existence and payment method validation
- Invoice DTOs structure line items, taxes, discounts, and payment status
- All monetary values are in cents (integer) to avoid floating-point precision issues
- Seat limits are validated against plan constraints (see `billing.constants.ts`)

### Testing Requirements
- Test plan creation with valid/invalid pricing (negative, zero, fractional)
- Test subscription creation with valid/invalid plan IDs
- Test invoice listing with date range filters and pagination
- Verify monetary calculations are accurate (no floating-point errors)
- Run tests: `npm test -- src/billing`

### Common Patterns
- Pricing validation: `@IsInt() @Min(0) priceInCents: number`
- Seat limits: `@IsInt() @Min(1) @Max(1000) maxSeats: number`
- Date ranges: `@IsOptional() @IsISO8601() startDate?: string`
- Status filtering: `@IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus`

## Dependencies

### Internal
- Used by `BillingController` for request/response validation
- Used by `BillingService` for business logic
- References `billing.constants.ts` for plan limits and pricing rules
- Integrates with `EntitlementsService` for feature access control

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration
- `@prisma/client` — Prisma enums for status values

<!-- MANUAL: -->
