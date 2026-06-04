# Frontend Docs

This directory turns the current NestJS backend into frontend-ready product planning material.

## Files

- [TYPES.ts](./TYPES.ts) - shared TypeScript entity/request/event types for frontend code.
- [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md) - current backend API, auth, realtime, settings, data model, and operational constraints.
- [PAGE_PLAN.md](./PAGE_PLAN.md) - page-by-page frontend plan based on the backend contract.
- [FRONTEND_IMPLEMENTATION_SPEC.md](./FRONTEND_IMPLEMENTATION_SPEC.md) - frontend architecture, API client behavior, route modules, caching, realtime, upload, UX states, and performance rules.
- [FRONTEND_COMPLETENESS_REVIEW.md](./FRONTEND_COMPLETENESS_REVIEW.md) - readiness audit for adapting the frontend to the current backend and backend gaps that block a fully automated/zero-guess integration.
- [API_REFERENCE.md](./API_REFERENCE.md) - quick API index pointing to the canonical backend contract.
- [PERMISSIONS.md](./PERMISSIONS.md) - auth, email verification, company roles, admin permissions, and route gates.

## Backend Defaults

- REST base URL: `/api/v1`
- Public exceptions without `/api/v1`: `GET /`, `GET /health/live`, `GET /health/ready`
- Auth: bearer access token in `Authorization: Bearer <token>`
- Refresh: HTTP-only `refreshToken` cookie scoped to `/api/v1/auth`
- Success response shape: `{ data, meta? }`
- Error response shape: `{ error: { code, message, details?, requestId? } }`
- Realtime namespaces: `/realtime` for notifications/presence, `/chat` for conversation events

## Frontend Build Notes

- Treat [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md) as the source of truth when wiring API calls.
- Use cursor pagination UI wherever endpoints accept `cursor` and `limit`.
- Prefer optimistic UI only for idempotent or reversible actions: follow/unfollow, save/unsave, read/unread, reactions, hide/unhide.
- Gate company, recruiting, billing, moderation, and admin routes by discovered role/permission data; current backend has no single session bootstrap endpoint, so see [FRONTEND_COMPLETENESS_REVIEW.md](./FRONTEND_COMPLETENESS_REVIEW.md).
- Keep file upload logic centralized because profile, company, application, post, message, and media pages share the same presigned upload flow.
- Treat [FRONTEND_COMPLETENESS_REVIEW.md](./FRONTEND_COMPLETENESS_REVIEW.md) as the cut line between features that can be built now and features that need backend additions before production-grade UX.
