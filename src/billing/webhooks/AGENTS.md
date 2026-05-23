<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Billing Webhooks

## Purpose
Handles incoming webhook events from payment providers (Stripe, PayPal, etc.) for subscription lifecycle events, payment confirmations, and invoice updates.

## Key Files
| File | Description |
|------|-------------|
| webhook.controller.ts | Webhook endpoint that receives and routes payment provider events |
| webhook.service.ts | Processes webhook events and updates subscription/invoice status |
| webhook-signature.guard.ts | Validates webhook signatures to prevent spoofing and replay attacks |

## Subdirectories
None

## For AI Agents

### Working In This Directory
- Webhook endpoints are public (no JWT auth) but require signature verification
- Signature guard validates HMAC signatures from payment providers
- Service handles idempotency using event IDs to prevent duplicate processing
- Events are processed asynchronously via outbox pattern for reliability
- Failed webhook processing is logged and retried with exponential backoff

### Testing Requirements
- Test signature validation with valid/invalid signatures
- Test idempotency (same event ID processed multiple times)
- Test event routing (subscription.created, invoice.paid, etc.)
- Verify outbox integration for async processing
- Mock payment provider webhooks in tests
- Run tests: `npm test -- src/billing/webhooks`

### Common Patterns
- Signature validation: `@UseGuards(WebhookSignatureGuard) @Post('stripe')`
- Idempotency check: `if (await this.isProcessed(eventId)) return;`
- Event routing: `switch (event.type) { case 'subscription.created': ... }`
- Outbox publishing: `await outboxService.publish('billing.subscription.updated', payload)`

## Dependencies

### Internal
- `../billing.service.ts` — Updates subscription and invoice data
- `../../outbox/outbox.service.ts` — Publishes events for async processing
- `../../infra/logger/` — Logs webhook events and errors

### External
- `@nestjs/common` — Controller, guard, and exception utilities
- `crypto` — HMAC signature verification
- Payment provider SDKs (Stripe, PayPal) — Event type definitions

<!-- MANUAL: -->
