<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# email

## Purpose
Email delivery module providing transactional email queueing and sending via SMTP. Uses Handlebars templates for email rendering and queues emails in the database for reliable delivery with retry support.

## Key Files
| File | Description |
|------|-------------|
| `email.module.ts` | Module configuration importing InfraModule and registering EmailProcessor |
| `email.service.ts` | Email queueing and Handlebars template rendering with caching |
| `email.processor.ts` | Background processor for sending queued emails via SMTP |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `templates/` | Handlebars email templates (email-verification.hbs, password-reset.hbs) |

## For AI Agents

### Working In This Directory
- EmailService.send queues emails in the email_deliveries table (does not send immediately)
- EmailProcessor runs in the background to process queued emails
- Templates are loaded from `templates/*.hbs` and cached in memory
- Template rendering uses Handlebars with context variables
- Email status transitions: queued → SENT (on success) or remains queued for retry (on failure)
- SMTP configuration is injected via MAILER_TRANSPORTER token from InfraModule

### Testing Requirements
- Test EmailService.send creates email_deliveries record
- Test EmailService.renderTemplate loads and compiles Handlebars templates
- Test EmailService.renderTemplate caches compiled templates
- Test EmailProcessor.process sends email via SMTP and updates status to SENT
- Test EmailProcessor.process logs errors and rethrows for retry
- Verify template context variables are interpolated correctly

### Common Patterns
- Use EmailService.send to queue emails (do not call EmailProcessor directly)
- Templates use Handlebars syntax: `{{variable}}` for interpolation
- Template cache prevents repeated file reads and compilation
- Email processor updates email_deliveries.status and sentAt on success
- Email processor logs errors but rethrows to trigger retry mechanism

## Dependencies

### Internal
- `../infra/prisma` - Database access for email_deliveries table
- `../infra/mailer` - SMTP transporter for sending emails
- `../infra/config` - SMTP configuration (host, port, auth)

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `handlebars` - Template rendering engine
- `fs` - File system access for loading templates
