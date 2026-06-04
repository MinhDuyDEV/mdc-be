# API Reference

Canonical source-synced API inventory lives in [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md).

Use this file as a quick index for frontend implementation.

## Base Rules

- REST base: `/api/v1`
- Prefix exclusions: `GET /`, `GET /health/live`, `GET /health/ready`
- Success: `{ data, meta? }`
- Error: `{ error: { code, message, details?, requestId? } }`
- Auth: `Authorization: Bearer <accessToken>`
- Refresh: `POST /api/v1/auth/refresh` uses `refreshToken` cookie, not a request body token.
- Webhooks bypass response wrapping.

## Endpoint Groups

- System/health: see [Backend Contract - System](./BACKEND_CONTRACT.md#system)
- Auth/session: see [Backend Contract - Auth](./BACKEND_CONTRACT.md#auth)
- Users/profiles: see [Backend Contract - Users And Profiles](./BACKEND_CONTRACT.md#users-and-profiles)
- Companies: see [Backend Contract - Companies](./BACKEND_CONTRACT.md#companies)
- Jobs: see [Backend Contract - Jobs](./BACKEND_CONTRACT.md#jobs)
- Applications: see [Backend Contract - Applications](./BACKEND_CONTRACT.md#applications)
- Feed/posts/comments/reactions: see [Backend Contract - Feed, Posts, Comments, Reactions](./BACKEND_CONTRACT.md#feed-posts-comments-reactions)
- Connections/follows/blocks: see [Backend Contract - Connections, Follows, Blocks](./BACKEND_CONTRACT.md#connections-follows-blocks)
- Messaging: see [Backend Contract - Messaging](./BACKEND_CONTRACT.md#messaging)
- Notifications: see [Backend Contract - Notifications](./BACKEND_CONTRACT.md#notifications)
- Media: see [Backend Contract - Media Upload](./BACKEND_CONTRACT.md#media-upload)
- Search/recommendations: see [Backend Contract - Search](./BACKEND_CONTRACT.md#search) and [Recommendations](./BACKEND_CONTRACT.md#recommendations)
- Recruiting: see [Backend Contract - Recruiting](./BACKEND_CONTRACT.md#recruiting)
- Billing: see [Backend Contract - Billing](./BACKEND_CONTRACT.md#billing)
- Moderation/admin/analytics: see [Backend Contract - Moderation](./BACKEND_CONTRACT.md#moderation), [Admin](./BACKEND_CONTRACT.md#admin), and [Analytics](./BACKEND_CONTRACT.md#analytics)
- Realtime: see [Backend Contract - Realtime Contract](./BACKEND_CONTRACT.md#realtime-contract)

## Upload Flow

1. `POST /api/v1/media/initiate` with `purpose`, `filename`, `contentType`, `sizeBytes`.
2. Upload bytes to returned `uploadUrl`.
3. `POST /api/v1/media/:id/confirm` with no body.
4. Use returned `mediaId` in profile, company, post, application, or message workflow only where backend DTO accepts it.

Current upload purposes: `avatar`, `resume`, `attachment`.

## Realtime Namespaces

- `/realtime`: authenticated notifications and presence; emits `notification:new`.
- `/chat`: authenticated conversation events; client emits `conversation:join`, `typing:started`, `typing:stopped`, `message:read`; server emits `message:new`, `typing:started`, `typing:stopped`, `message:read`.

Token can be sent via Socket.IO `auth.token` or `Authorization: Bearer <token>` header.
