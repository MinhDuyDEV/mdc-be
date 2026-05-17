# Rollback Runbook

## Quick Rollback

1. Identify the last known-good deployment
2. Re-deploy the previous container image tag
3. Verify health checks pass after rollback

## Database Rollback

Prisma migrations should be backward-compatible. If a migration must be rolled back:

```bash
npx prisma migrate resolve --rolled-back <migration_name>
npx prisma migrate deploy
```

## Verification

After rollback, check:

- Health endpoints: `/health/live`, `/health/ready`
- Outbox backlog: pending event count
- Error rates and logs
