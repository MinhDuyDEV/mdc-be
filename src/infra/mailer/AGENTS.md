<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# mailer

## Purpose
Email delivery abstraction using Nodemailer with environment-aware transport configuration. Provides presigned URL generation for email sending, health checks with timeout protection, and support for both SMTP and stream-based transports for development/testing scenarios.

## Key Files
| File | Description |
|------|-------------|
| `mailer.service.ts` | Core email sending service with connection verification and mail dispatch |
| `mailer.health.ts` | Health check service with timeout protection for SMTP verification |
| `mailer.provider.ts` | Factory provider that creates Nodemailer transporter based on environment |
| `mailer.constants.ts` | DI token and type definitions for mailer transporter |
| `index.ts` | Public exports for the mailer module |

## For AI Agents

### Working In This Directory
- Mailer is provided as a NestJS provider via `mailerTransporterProvider` factory
- Development mode (when `smtpHost` is empty) uses stream transport for testing without actual SMTP
- Production mode uses configured SMTP server with TLS settings based on environment
- `MailerService` requires injected transporter and ConfigService
- Health checks use `Promise.race()` to enforce timeout limits
- Stream transport has `verify === false` (not a function), so health checks skip verification for dev mode

### Testing Requirements
- Verify mailer provider creates correct transporter based on environment
- Test `sendMail()` with valid recipient, subject, and HTML content
- Confirm `verifyConnection()` works with SMTP transporter
- Validate health check timeout behavior (should reject if verification exceeds timeout)
- Test that stream transport in development doesn't throw errors
- Verify `emailFrom` config is correctly applied to sent emails

### Common Patterns
- Inject `MAILER_TRANSPORTER` token to access Nodemailer transporter
- Use `MailerService.sendMail()` with object containing `to`, `subject`, `html`, and optional `text`
- Health checks use timeout wrapper pattern with `Promise.race()` and `setTimeout()`
- Configuration values are retrieved via `ConfigService.get()` with `infer: true`
- Stream transport is used for development to avoid SMTP dependency

## Dependencies

### Internal
- `../config` — AppConfig type for SMTP and email configuration

### External
- `@nestjs/common` — NestJS core decorators
- `@nestjs/config` — NestJS configuration service
- `nodemailer` — Email sending library with multiple transport options
