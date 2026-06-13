# GDPR Module

## Purpose

GDPR/CCPA compliance module providing data deletion (Art. 17) and data export (Art. 20) capabilities. Users can request data export and account deletion via self-service endpoints; admins can initiate deletion on behalf of users. All PII is anonymized or deleted within a 30-day SLA, with a tamper-evident audit trail.

## Key Files

| File                          | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `gdpr.module.ts`              | Module definition importing GDPR dependencies |
| `gdpr.controller.ts`          | REST endpoints for GDPR operations            |
| `gdpr.service.ts`             | Anonymization orchestrator with cascade logic |
| `deletion-request.service.ts` | DeletionRequest CRUD with FSM validation      |
| `data-export.service.ts`      | JSON+ZIP generation with S3 upload            |
| `gdpr-sla-monitor.service.ts` | Daily cron for 30-day SLA enforcement         |

## Dependencies

### Internal (Allowed by eslint.config.mjs)

- **users** - User lookup and profile operations
- **auth** - Session revocation
- **outbox** - Event emission for async processing
- **common** - Shared decorators and guards

### External

- **infra** - PrismaService, StorageService, LeaderLockService

## Events Emitted

- `UserDataExportRequested` - When a user requests data export
- `UserDataExported` - When export ZIP is generated and uploaded
- `UserDataDeleted` - When user data is deleted (triggers async cascade)
- `UserDataAnonymized` - When user PII is replaced with anonymized values
