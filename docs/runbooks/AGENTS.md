<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# docs/runbooks/

## Purpose

Operational procedures for deployment, incident response, system maintenance, and troubleshooting. These runbooks provide step-by-step instructions for operators and on-call engineers to safely execute critical operations.

## Key Files

| File | Description |
|------|-------------|
| `deploy.md` | Deployment process and verification steps |
| `rollback.md` | Rollback procedures and recovery steps |
| `incident.md` | Incident response and triage procedures |
| `outbox-backlog.md` | Outbox recovery and performance tuning procedures |
| `outbox-replay.md` | Dead-letter event replay procedures (1.2KB) |

## For AI Agents

### When to Read These Docs

- **Before deploying to production** — read deploy.md for the deployment process and verification
- **When a deployment fails** — read rollback.md for recovery procedures
- **During an incident** — read incident.md for triage and response steps
- **When outbox is backing up** — read outbox-backlog.md for recovery and tuning
- **When replaying dead-letter events** — read outbox-replay.md for the replay procedure
- **When onboarding operators** — use runbooks as training material

### How to Use Them

1. **Follow runbooks exactly** — they are tested procedures; deviations can cause issues
2. **Test in staging first** — verify procedures work before using in production
3. **Document deviations** — if you deviate from a runbook, document why and update the runbook
4. **Keep runbooks current** — update runbooks when procedures change
5. **Link to runbooks in alerts** — include runbook links in on-call alerts and dashboards
6. **Review runbooks regularly** — quarterly review to ensure procedures are still accurate

### Runbook Template

```markdown
# Operation Name

## Prerequisites

- Requirement 1
- Requirement 2
- Access to: service, tool, credentials

## Steps

1. Step 1 with specific commands
2. Step 2 with specific commands
3. Step 3 with specific commands

## Verification

- Check 1: How to verify step 1 worked
- Check 2: How to verify step 2 worked
- Check 3: How to verify step 3 worked

## Rollback

- Rollback step 1 with specific commands
- Rollback step 2 with specific commands

## Troubleshooting

### Issue: Problem description
- Symptom: What to look for
- Cause: Why it happens
- Fix: How to resolve

## References

- Link to related docs
- Link to related code
- Link to related runbooks
```

## Dependencies

### Internal

- `src/outbox/` — Outbox pattern implementation (referenced in outbox-backlog.md and outbox-replay.md)
- `src/jobs/` — Scheduled jobs (referenced in deploy.md)
- `.github/workflows/` — CI/CD pipeline (referenced in deploy.md)
- `docs/decisions/` — ADRs affecting operations (e.g., ADR-0006 cron leader election)
- `docs/baseline/` — Baseline metrics for performance targets

### External

- Deployment infrastructure (AWS, GCP, etc.)
- Monitoring and alerting system
- On-call rotation and escalation procedures

## Key Concepts

### Deployment Process

From `deploy.md`:

1. Verify all tests passing
2. Build Docker image
3. Push to registry
4. Update deployment manifest
5. Apply to cluster
6. Verify health checks
7. Monitor for errors

### Rollback Procedure

From `rollback.md`:

1. Identify the bad deployment
2. Revert to previous image
3. Apply to cluster
4. Verify health checks
5. Monitor for recovery
6. Post-incident review

### Incident Response

From `incident.md`:

1. Assess severity and impact
2. Notify stakeholders
3. Triage the issue
4. Execute fix or rollback
5. Verify recovery
6. Post-incident review

### Outbox Recovery

From `outbox-backlog.md`:

1. Check outbox table size
2. Identify stuck events
3. Tune polling parameters
4. Replay failed events
5. Monitor recovery

### Dead-Letter Replay

From `outbox-replay.md`:

1. Identify events in dead-letter queue
2. Verify fix is deployed
3. Execute replay procedure
4. Monitor for success
5. Archive replayed events

## Common Patterns

**Verification Checklist:**

```markdown
## Verification

- [ ] Health check endpoint returns 200
- [ ] Logs show no errors
- [ ] Metrics show normal traffic
- [ ] Database connections healthy
- [ ] Realtime connections established
- [ ] Background jobs running
```

**Rollback Checklist:**

```markdown
## Rollback

- [ ] Identify previous stable version
- [ ] Revert deployment manifest
- [ ] Apply to cluster
- [ ] Verify health checks
- [ ] Monitor error rate
- [ ] Notify stakeholders
```

**Troubleshooting Section:**

```markdown
## Troubleshooting

### Issue: Health check failing
- Symptom: GET /health/live returns 500
- Cause: Database connection pool exhausted
- Fix: Restart pod, check database connections

### Issue: High error rate
- Symptom: Error rate > 1%
- Cause: Downstream service unavailable
- Fix: Check downstream service status, rollback if needed
```

## Subdirectory Structure

This is a leaf directory. No subdirectories.

## On-Call Workflow

1. **Alert received** — check alert dashboard for runbook link
2. **Read runbook** — understand the procedure and prerequisites
3. **Execute steps** — follow runbook exactly, document any deviations
4. **Verify** — confirm each step worked before proceeding
5. **Escalate if needed** — if runbook doesn't resolve, escalate to on-call lead
6. **Post-incident** — update runbook if procedure changed or failed

## Runbook Maintenance

- **Monthly review** — check that procedures are still accurate
- **After incidents** — update runbooks based on incident learnings
- **Before major changes** — update runbooks to reflect new procedures
- **Quarterly audit** — verify all runbooks are current and tested

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
