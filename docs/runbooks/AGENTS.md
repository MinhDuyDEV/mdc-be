<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T04:19:26Z | Updated: 2026-05-23T04:19:26Z -->

# runbooks/

## Purpose

Operational runbooks for deployment, incident response, rollback procedures, and system maintenance. These documents guide operators through common operational tasks and emergency procedures.

## Key Files

| File | Description |
|------|-------------|
| `deploy.md` | Deployment process: prerequisites, CI pipeline, manual approval, and verification steps |
| `rollback.md` | Rollback procedures: quick rollback, database migration rollback, and post-rollback verification |
| `incident.md` | Incident response: triage steps, common incidents (outbox backlog, database/Redis failures), and escalation |
| `outbox-backlog.md` | Outbox recovery procedures: stale lock recovery, dead-letter replay, backlog monitoring, and performance tuning |

## For AI Agents

### Working In This Directory

- **Keep runbooks actionable** — focus on step-by-step procedures, not theory
- **Test procedures regularly** — verify runbooks work in staging before production incidents
- **Update after incidents** — capture lessons learned and improve procedures
- **Link to monitoring** — reference specific metrics, dashboards, and alerts
- **Include verification steps** — every procedure should have a "how to verify success" section

### Testing Requirements

No automated tests. Verification is manual:

1. Follow the runbook in a staging environment
2. Verify each step produces expected results
3. Check that verification steps catch failures
4. Ensure rollback procedures work

### Common Patterns

**Runbook Structure:**
```markdown
# Operation Name

## Prerequisites
- Requirement 1
- Requirement 2

## Steps
1. Step 1 with command
2. Step 2 with expected output
3. Step 3 with verification

## Verification
- Check 1
- Check 2

## Rollback (if applicable)
- Rollback step 1
- Rollback step 2
```

**SQL Queries:**
```sql
-- Include exact queries for common operations
SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING';
```

**Health Checks:**
```bash
# Include curl commands for health endpoints
curl http://localhost:3000/health/ready
```

## Dependencies

### Internal

- `src/` — Application code referenced in runbooks
- `prisma/` — Database schema and migrations referenced in rollback procedures
- `.github/workflows/` — CI/CD pipelines referenced in deployment runbook

### External

- **Docker** — Container runtime for deployments
- **PostgreSQL** — Database for outbox recovery queries
- **Redis** — Cache for incident troubleshooting

## Key Procedures

**Deployment (`deploy.md`):**
1. Merge PR to main
2. CI pipeline runs tests and builds container
3. Deploy workflow triggers
4. Manual approval for production

**Rollback (`rollback.md`):**
1. Identify last known-good deployment
2. Re-deploy previous container image
3. Verify health checks pass
4. For database rollback: use `prisma migrate resolve --rolled-back`

**Incident Response (`incident.md`):**
1. Check health endpoints: `/health/live`, `/health/ready`
2. Review error logs
3. Check database and Redis connectivity
4. Check outbox backlog
5. Follow specific incident procedures

**Outbox Recovery (`outbox-backlog.md`):**
- Stale lock recovery: Reset PROCESSING events older than 60 seconds
- Dead-letter replay: Use DeadLetterService API
- Backlog monitoring: Check pending event count
- Performance tuning: Adjust `OUTBOX_BATCH_SIZE`

<!-- MANUAL: -->
