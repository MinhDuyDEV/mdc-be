# Incident Response Runbook

## Triage

1. Check health endpoints: `/health/live`, `/health/ready`
2. Review recent error logs
3. Check database connectivity
4. Check Redis connectivity
5. Check outbox backlog

## Common Incidents

### Outbox Backlog

See `docs/runbooks/outbox-backlog.md`.

### Database Connection Failures

- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Check connection limits

### Redis Connection Failures

- Verify REDIS_URL is correct
- Check Redis is running
- Check memory limits

## Escalation

If unable to resolve within 15 minutes:

- Escalate to on-call engineer
- Document findings and actions taken
