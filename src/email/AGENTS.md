<!-- Parent: ../AGENTS.md -->

# Email Domain

## Purpose

The Email domain provides transactional email delivery via a queue-based architecture. It renders Handlebars templates, queues emails in the database, and processes them asynchronously. This domain is infrastructure-focused and does not depend on other business domains.

## Key Files

- **email.service.ts**: Email queueing and template rendering. Queues emails to `EmailDelivery` table and caches compiled Handlebars templates.
- **email.processor.ts**: Asynchronous email processing. Renders templates, sends via SMTP, and updates delivery status.
- **email.module.ts**: Module definition. Exports `EmailService` for use by other domains.

## Subdirectories

- **templates/**: Handlebars email templates
  - `email-verification.hbs`: Email verification template
  - `password-reset.hbs`: Password reset template
  - `application-status-changed.hbs`: Job application status notification template

## For AI Agents

### Working Instructions

1. **Queue-based delivery**: Emails are not sent immediately. `EmailService.send()` writes to `EmailDelivery` table, and `EmailProcessor.process()` handles actual delivery asynchronously.
2. **Template rendering**: Templates are loaded from `templates/` directory and compiled with Handlebars. Compiled templates are cached in memory for performance.
3. **Template context**: Each template receives a `context` object with template-specific variables. Context is stored as JSON in the database.
4. **Delivery status tracking**: `EmailDelivery` records track status (PENDING, SENT, FAILED) and timestamps (sentAt, failedAt).
5. **Error handling**: Failed emails are logged but not retried automatically. Implement retry logic in the event processor if needed.

### Testing Requirements

- Test template rendering: verify Handlebars compilation and variable substitution
- Test template caching: verify templates are loaded once and reused
- Test queue persistence: verify emails are written to database before sending
- Test status updates: verify status transitions (PENDING → SENT, PENDING → FAILED)
- Test error handling: verify failed sends are logged and status is updated

### Common Patterns

- **Template loading**: Templates are loaded from filesystem on first use and cached in `templateCache` Map
- **Fallback rendering**: If template loading fails, use empty template to prevent crashes
- **Logging**: All email operations are logged with template name and recipient
- **JSON context**: Template context is stored as `Prisma.InputJsonValue` for database persistence

## Dependencies

### Internal (Domain Imports)

None. This domain is infrastructure-focused and does not import from other business domains.

### External (Infrastructure)

- **infra/prisma**: Database access via `PrismaService`
- **infra/mailer**: SMTP transport via `MAILER_TRANSPORTER` injection token
- **infra/config**: App configuration via `ConfigService`
- **@nestjs/config**: Configuration management
- **handlebars**: Template rendering
- **@prisma/client**: `EmailStatus` enum

### Allowed Imports (per eslint.config.mjs)

This domain can import from: `email` (self) only

## Database Schema

- **EmailDelivery**: Queued emails with to, subject, template, context, status, sentAt, failedAt

## Events Emitted

None. This domain does not emit outbox events.

## Template Variables

### email-verification.hbs
- `verificationUrl`: URL for email verification

### password-reset.hbs
- `resetUrl`: URL for password reset

### application-status-changed.hbs
- `applicantName`: Name of the applicant
- `jobTitle`: Title of the job
- `companyName`: Name of the company
- `status`: New application status
