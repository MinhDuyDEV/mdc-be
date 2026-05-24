# Outbox Dead Letter Replay Runbook

## Purpose

Use the admin dead-letter endpoints to inspect failed outbox events and replay a single event after the underlying cause is fixed.

## Access

- Required role: `admin`
- Required permission: `MANAGE_ADMINS`
- Endpoints are under `/api/v1/admin/outbox/dead-letter`

## Inspect

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://api.example.com/api/v1/admin/outbox/dead-letter?eventType=UserRegistered"
```

Response includes up to 50 rows and `meta.endCursor` for pagination.

## Replay

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://api.example.com/api/v1/admin/outbox/dead-letter/<dead-letter-id>/replay"
```

Replay creates a new `PENDING` outbox event, deletes the dead-letter row, and writes an audit log entry in one database transaction.

## Checks

1. Confirm the original failure reason is understood.
2. Confirm the event payload matches the current event-schema registry.
3. Replay one event first.
4. Watch outbox metrics: `outbox.events.processed`, `outbox.events.failed`, `outbox.events.dead_lettered`.
5. Verify the expected side effect, such as notification delivery or search indexing.
