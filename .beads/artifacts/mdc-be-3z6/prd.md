# Phase 7 Follow-up: Fix Review-Issued Issues

## Problem

After creating PR #11 for messaging, a 5-agent code review found 5 issues requiring follow-up work:

1. **Block check on sendMessage**: `MessagingPolicyService.canCreateConversation` checks block when creating a conversation, but `sendMessage` only checks `isActiveParticipant`. If user B blocks user A after conversation exists, A can keep sending messages and generating notifications for B.

2. **E2E tests mock entire PrismaService**: `test/messaging.e2e-spec.ts` replaces every Prisma method with fixed-return `jest.fn()`, so tests pass even if implementation is materially wrong (wrong participantIds, wrong outbox payload, wrong content).

3. **MessagingPolicyService reimplements ConnectionsPolicyService.isBlocked**: `src/messaging/messaging-policy.service.ts:24-37` does raw `prisma.block.findFirst`, while `src/connections/connections-policy.service.ts` already has `isBlocked`. RecruitingPolicyService already delegates correctly.

4. **lastMessageAt write race**: When two messages are sent concurrently, the last writer may overwrite `lastMessageAt` / `lastMessagePreview` with the older message's data. A monotonic guard via `updateMany` with `OR [lastMessageAt: null, lastMessageAt: { lt: ... }]` was added in PR #11 but uses `updateMany` (returns count, not row) and needs test coverage.

5. **Orphaned schema models**: `MessageAttachment` and `MessageReadState` are defined in `prisma/schema.prisma` and migrated, but zero code paths reference them. They remain orphaned until Phase 7.1 or Phase 8.

## Solution

| # | Issue | Fix | Complexity |
|---|-------|-----|------------|
| 1 | Block check on sendMessage | Inject `ConnectionsPolicyService` into `MessagingPolicyService`, add `canSendMessage` method that calls `isBlocked`; call it in `sendMessage` before message creation | **S** |
| 2 | E2E tests mock PrismaService | Rewrite E2E suite to use real test database (Testcontainers), matching `posts.e2e-spec.ts` and `feed.e2e-spec.ts` patterns | **M** |
| 3 | Reimplements ConnectionsPolicyService | Inject `ConnectionsPolicyService` into `messaging-policy.service.ts`, replace inline `prisma.block.findFirst` with `connectionsPolicy.isBlocked()` | **S** |
| 4 | lastMessageAt write race | Verify existing `updateMany` monotonic guard works; if `updateMany` does not support OR in where, switch to `$executeRaw` or serializable isolation for the send transaction; add unit test covering concurrent-write scenario | **S** |
| 5 | Orphaned schema models | Add comment in schema noting deferred to Phase 7.1; no code change needed (PRD already lists them as out-of-scope) | **S** |

## Affected Files

- `src/messaging/messaging-policy.service.ts` — inject ConnectionsPolicyService, replace inline block check, add canSendMessage
- `src/messaging/messaging-policy.service.spec.ts` — update tests for delegated block check + new method
- `src/messaging/messaging.service.ts` — call canSendMessage in sendMessage
- `src/messaging/messaging.service.spec.ts` — add block-on-send test, add write-race test
- `src/messaging/messaging.module.ts` — ensure ConnectionsModule is imported (already is)
- `test/messaging.e2e-spec.ts` — rewrite to use real database
- `prisma/schema.prisma` — add comment on MessageAttachment/MessageReadState deferred status

## Tasks

### 1. Delegate block check to ConnectionsPolicyService [refactor]

Replace inline `prisma.block.findFirst` in `messaging-policy.service.ts` with `ConnectionsPolicyService.isBlocked()`. Also add `canSendMessage` method wrapping `isActiveParticipant` + `isBlocked` check.

**Verification:**
- Verify: `npm run typecheck && npm run lint`
- Verify: `npx jest src/messaging/messaging-policy.service.spec.ts` passes
- Verify: Call `canSendMessage` when block exists → returns false

**Files:** `src/messaging/messaging-policy.service.ts`, `src/messaging/messaging-policy.service.spec.ts`

### 2. Add block check to sendMessage [functional]

Call `messagingPolicy.canSendMessage(userId, conversationId)` in `sendMessage` before creating the message. If blocked, throw `ForbiddenException('BLOCKED_USER')`.

**Verification:**
- Verify: `npm run typecheck && npm run lint`
- Verify: `npx jest src/messaging/messaging.service.spec.ts -- -t "blocked"` passes
- Verify: `npx jest src/messaging/` — all tests pass

**Files:** `src/messaging/messaging.service.ts`, `src/messaging/messaging.service.spec.ts`

### 3. Verify and test lastMessageAt monotonic guard [testing]

Ensure `updateMany` with OR in where works correctly with Prisma (it does). Add unit test verifying that when two messages are sent concurrently, the older message does NOT overwrite the newer message's `lastMessageAt`.

**Verification:**
- Verify: `npx jest src/messaging/messaging.service.spec.ts -- -t "concurrent\|monotonic\|lastMessage"` passes
- Verify: `npm run typecheck && npm run lint`

**Files:** `src/messaging/messaging.service.spec.ts`

### 4. Rewrite E2E tests with real database [testing]

Replace mocked `PrismaService` in `test/messaging.e2e-spec.ts` with a real test database, following the pattern established in `test/posts.e2e-spec.ts` and `test/feed.e2e-spec.ts`.

**Verification:**
- Verify: `npm run test:e2e -- messaging` — all tests pass against real DB
- Verify: Blocked user E2E test: block between two users, attempt sendMessage → 403
- Verify: Recruiting denial E2E test: canMessageCandidate returns { allowed: false } → 403
- Verify: Cursor pagination round-trip: create 25 messages, paginate through all pages

**Files:** `test/messaging.e2e-spec.ts`

### 5. Document orphaned schema models [docs]

Add comment in `prisma/schema.prisma` noting `MessageAttachment` and `MessageReadState` are deferred to Phase 7.1 or Phase 8.

**Verification:**
- Verify: `npx prisma validate`
- Verify: Comment is present above both models

**Files:** `prisma/schema.prisma`

## Success Criteria

- Verify: `npm run typecheck` passes
- Verify: `npm run lint` — 0 errors
- Verify: `npx jest src/messaging/` — all tests pass
- Verify: `npm run test:e2e -- messaging` — all tests pass (real DB)
- Verify: Blocked user cannot send messages after conversation exists
- Verify: MessagingPolicyService delegates block check to ConnectionsPolicyService (no duplicate implementation)
