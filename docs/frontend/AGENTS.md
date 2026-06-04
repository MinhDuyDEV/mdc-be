<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# docs/frontend/

## Purpose

Frontend specifications, API contracts, page plans, and implementation guides. This directory is the authoritative source for frontend integration with the backend, including data types, API endpoints, authentication, realtime events, and page-by-page implementation details.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Overview, file guide, and backend defaults (REST base URL, auth, response shapes) |
| `BACKEND_CONTRACT.md` | Current backend API, auth, realtime, settings, data model, and operational constraints (35KB, authoritative source) |
| `TYPES.ts` | Shared TypeScript entity/request/event types for frontend code |
| `PAGE_PLAN.md` | Page-by-page frontend plan based on backend contract (24KB) |
| `FRONTEND_IMPLEMENTATION_SPEC.md` | Frontend architecture, API client behavior, route modules, caching, realtime, upload, UX states, and performance rules (15KB) |
| `FRONTEND_COMPLETENESS_REVIEW.md` | Readiness audit for adapting frontend to current backend and backend gaps blocking full integration (7.7KB) |
| `FRONTEND_PAGES_PLAN.md` | Detailed page implementation plan |
| `API_REFERENCE.md` | Quick API index pointing to canonical backend contract |
| `PERMISSIONS.md` | Auth, email verification, company roles, admin permissions, and route gates (7.4KB) |
| `IMAGE_GENERATION_PROMPTS.md` | Image generation specifications and prompts (38KB) |

## For AI Agents

### When to Read These Docs

- **Before wiring API calls** — read BACKEND_CONTRACT.md for endpoint paths, request/response shapes, and error codes
- **When implementing authentication** — read PERMISSIONS.md for auth flow, email verification, role-based access, and route gates
- **When building pages** — read PAGE_PLAN.md for page structure and FRONTEND_IMPLEMENTATION_SPEC.md for caching, realtime, and upload patterns
- **When integrating realtime features** — read BACKEND_CONTRACT.md realtime section for namespace structure and event types
- **When handling file uploads** — read FRONTEND_IMPLEMENTATION_SPEC.md for centralized presigned upload flow
- **When checking feature readiness** — read FRONTEND_COMPLETENESS_REVIEW.md to identify backend gaps blocking production UX

### How to Use Them

1. **Treat BACKEND_CONTRACT.md as source of truth** — all API calls must match the contract
2. **Use TYPES.ts for type safety** — import shared types instead of duplicating definitions
3. **Follow pagination patterns** — use cursor pagination UI wherever endpoints accept `cursor` and `limit`
4. **Implement optimistic UI carefully** — only for idempotent or reversible actions (follow/unfollow, save/unsave, read/unread, reactions, hide/unhide)
5. **Gate routes by permissions** — use role/permission data from PERMISSIONS.md to control access
6. **Centralize file uploads** — profile, company, application, post, message, and media pages share the same presigned upload flow
7. **Check completeness before shipping** — FRONTEND_COMPLETENESS_REVIEW.md identifies features that need backend additions

### Backend Defaults (from README.md)

```
REST base URL: /api/v1
Public exceptions: GET /, GET /health/live, GET /health/ready
Auth: Bearer access token in Authorization: Bearer <token>
Refresh: HTTP-only refreshToken cookie scoped to /api/v1/auth
Success response: { data, meta? }
Error response: { error: { code, message, details?, requestId? } }
Realtime namespaces: /realtime (notifications/presence), /chat (conversation events)
```

## Dependencies

### Internal

- `src/` — Backend code implementing the contract
- `prisma/schema.prisma` — Database schema referenced in data model section
- `docs/decisions/` — ADRs affecting frontend integration (e.g., ADR-0001 refresh token shape, ADR-0002 media visibility)
- `docs/baseline/` — Baseline metrics for performance targets

### External

- Frontend repository — consumes BACKEND_CONTRACT.md, TYPES.ts, and PERMISSIONS.md
- Design system — referenced in IMAGE_GENERATION_PROMPTS.md

## Key Concepts

### API Response Shape

```typescript
// Success
{ data: T, meta?: { cursor?, limit?, total? } }

// Error
{ error: { code: string, message: string, details?: any, requestId?: string } }
```

### Authentication Flow

1. POST `/api/v1/auth/login` → returns `{ data: { accessToken, user } }` + `refreshToken` cookie
2. Use `Authorization: Bearer <accessToken>` for all requests
3. On 401, POST `/api/v1/auth/refresh` → returns new `accessToken`
4. `refreshToken` is HTTP-only, scoped to `/api/v1/auth`

### Pagination

- Use `cursor` and `limit` query parameters
- Response includes `meta: { cursor, limit, total }`
- Implement cursor pagination UI for infinite scroll or "load more"

### Realtime Events

- `/realtime` namespace: notifications, presence, user status
- `/chat` namespace: conversation messages, typing indicators
- Subscribe on mount, unsubscribe on unmount

### File Upload

- All file uploads use presigned URLs from backend
- Centralized upload logic in API client
- Used by: profile, company, application, post, message, media pages

## Common Patterns

**API Client Pattern:**

```typescript
// From FRONTEND_IMPLEMENTATION_SPEC.md
const client = new ApiClient({
  baseURL: '/api/v1',
  auth: { getToken: () => localStorage.getItem('accessToken') },
  onRefresh: () => POST('/auth/refresh'),
});

// Cursor pagination
const { data, meta } = await client.get('/posts', { cursor, limit: 20 });
```

**Route Gating Pattern:**

```typescript
// From PERMISSIONS.md
if (user.role === 'admin') {
  // Show admin routes
}
if (user.permissions.includes('billing:manage')) {
  // Show billing routes
}
```

**Optimistic UI Pattern:**

```typescript
// Only for idempotent/reversible actions
const toggleFollow = async (userId) => {
  setIsFollowing(!isFollowing); // Optimistic
  try {
    await client.post(`/users/${userId}/follow`);
  } catch {
    setIsFollowing(!isFollowing); // Revert on error
  }
};
```

## Subdirectory Structure

This is a leaf directory. No subdirectories.

## Readiness Checklist

Before shipping frontend features, verify:

- [ ] All API endpoints in BACKEND_CONTRACT.md are implemented
- [ ] Error handling matches error response shape
- [ ] Authentication flow matches PERMISSIONS.md
- [ ] Realtime subscriptions match namespace structure
- [ ] File uploads use centralized presigned URL flow
- [ ] Route gating matches role/permission data
- [ ] Pagination uses cursor pattern where applicable
- [ ] No backend gaps from FRONTEND_COMPLETENESS_REVIEW.md block the feature

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
