<!-- Parent: ../AGENTS.md -->

# Connections Domain

## Purpose

The Connections domain manages professional relationships between users: connection requests, follows, and blocks. It implements LinkedIn-style networking with bidirectional connections (mutual acceptance required), unidirectional follows (no acceptance needed), and blocking (prevents all interactions).

## Key Files

- **connections.service.ts**: Core business logic for connections, follows, and blocks. Implements idempotent operations, block enforcement, and automatic cleanup (blocking removes connections/follows).
- **connections-policy.service.ts**: Relationship query helpers (`areConnected`, `isBlocked`, `isFollowing`). Used by other domains to enforce visibility rules.
- **connections.controller.ts**: REST endpoints for connection lifecycle (send/accept/decline/remove requests, follow/unfollow, block/unblock).
- **connections.module.ts**: Module definition. Exports `ConnectionsService` and `ConnectionsPolicyService` for use by other domains.

## Subdirectories

- **dto/**: Request/response DTOs
  - `send-connection-request.dto.ts`: Connection request payload
  - `connection-response.dto.ts`: Connection response shape

## For AI Agents

### Working Instructions

1. **Connection requests are idempotent**: Sending a duplicate request throws `CONNECTION_ALREADY_EXISTS`. Accepting/declining requires `PENDING` status.
2. **Blocks are bidirectional**: If A blocks B, both A and B cannot see each other's content. Check blocks before allowing any interaction.
3. **Block side effects**: Creating a block automatically removes existing connections (both directions) and deactivates follows (both directions). This happens in a single transaction.
4. **Follows are unidirectional**: A can follow B without B's approval. Follows are idempotent (reactivate if exists).
5. **Cursor pagination**: All list endpoints use `(createdAt DESC, id DESC)` keyset pagination with base64-encoded cursors.
6. **Outbox pattern**: Connection lifecycle events (`ConnectionRequested`, `ConnectionAccepted`, `UserBlocked`) are emitted via `OutboxService` for downstream processing.

### Testing Requirements

- Test block enforcement: blocked users cannot send connection requests or follows
- Test idempotency: duplicate connection requests, duplicate follows, duplicate blocks
- Test block side effects: verify connections and follows are removed when blocking
- Test cursor pagination: verify `hasNextPage` and `nextCursor` correctness
- Test bidirectional connection queries: both requester and addressee can list their connections

### Common Patterns

- **Idempotency keys**: `Connection:sendRequest` and `Connection:blockUser` use `IdempotencyService` to prevent duplicate operations
- **Block checks**: Always call `ConnectionsPolicyService.isBlocked()` before allowing interactions between users
- **Transaction boundaries**: Block creation, connection acceptance, and connection requests all use `$transaction` to ensure atomicity
- **Cursor encoding**: Use `encodeCursor(createdAt, id)` and `decodeCursor(cursor)` helpers for pagination

## Dependencies

### Internal (Domain Imports)

- **outbox**: Event emission for connection lifecycle events

### External (Infrastructure)

- **infra/prisma**: Database access via `PrismaService`
- **@prisma/client**: `ConnectionStatus`, `FollowStatus` enums

### Allowed Imports (per eslint.config.mjs)

This domain can import from: `connections` (self), `outbox`

## Database Schema

- **Connection**: Tracks connection requests and their status (PENDING, ACCEPTED, DECLINED, REMOVED)
- **Follow**: Tracks follow relationships with status (ACTIVE, INACTIVE)
- **Block**: Tracks block relationships (no status, existence = blocked)

## Events Emitted

- `ConnectionRequested`: When a connection request is sent
- `ConnectionAccepted`: When a connection request is accepted
- `UserBlocked`: When a user blocks another user
