# Outbox Recovery Runbook

## Stale Lock Recovery

If events are stuck in `PROCESSING` status:

```sql
UPDATE outbox_events
SET status = 'PENDING', locked_at = NULL, locked_by = NULL
WHERE status = 'PROCESSING'
  AND locked_at < NOW() - INTERVAL '60 seconds';
```

## Dead Letter Replay

Replay a dead-letter event via the DeadLetterService API.

## Backlog Monitoring

Check pending event count:

```sql
SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING';
```

Health check fails if count > `OUTBOX_HEALTH_LAG_THRESHOLD` (default: 100).

## Performance Tuning

- Increase `OUTBOX_BATCH_SIZE` for high-throughput systems
- Decrease `OUTBOX_POLL_INTERVAL_MS` for lower latency
- Monitor `outbox_events` table size and archive old records
