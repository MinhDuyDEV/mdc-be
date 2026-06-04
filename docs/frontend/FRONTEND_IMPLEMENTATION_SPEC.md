# Frontend Implementation Spec

This spec defines how the frontend should consume the current backend while keeping UI/UX complete, predictable, and fast.

## Product Modules

| Module                     | Primary pages                                                          | Backend status                                 |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| Auth                       | Login, register, verify email, forgot/reset password, logout           | Supported                                      |
| Account/profile            | Account settings, profile onboarding, profile view/edit, endorsements  | Supported; profile detail requires auth        |
| Feed/posts                 | Home feed, post detail, composer, comments, reactions, save/hide       | Supported; saved-post list endpoint missing    |
| Network                    | Connections, pending requests, people search, follow/block             | Supported; followers/following list missing    |
| Jobs/applications          | Job search/detail, saved jobs, apply, my applications, review pipeline | Supported                                      |
| Companies                  | Directory, detail, create/edit, members, invitations, recruiter seats  | Supported                                      |
| Employer                   | Job dashboard, create/edit/publish/close jobs, applications            | Supported                                      |
| Recruiting                 | Saved candidates, talent pools, recruiting message                     | Supported; some candidate-note UX not routed   |
| Messaging                  | Inbox, thread, new direct/recruiting conversation, typing/read states  | Supported; attachments/groups not routed       |
| Notifications              | Bell, center, preferences                                              | Supported                                      |
| Search/recommendations     | Search results, recommendations                                        | Supported; recommendation feedback missing     |
| Billing                    | Plans, subscription, invoices, admin plan management                   | Supported                                      |
| Moderation/admin/analytics | Queue, actions, admin users/companies/jobs, outbox, reindex, analytics | Supported                                      |
| Media                      | Presigned upload/download                                              | Supported for `avatar`, `resume`, `attachment` |

## Route Architecture

Use route groups that match backend ownership.

| Frontend route group          | Pages                                                                 | Guard                                    |
| ----------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `/`                           | Public home                                                           | public                                   |
| `/auth/*`                     | Login, register, verify, reset                                        | anonymous or public                      |
| `/onboarding/profile`         | Profile completion                                                    | authenticated                            |
| `/profile/me`, `/profile/:id` | Own/member profile                                                    | authenticated for detail                 |
| `/settings/*`                 | Account, notifications                                                | authenticated                            |
| `/feed`, `/posts/:id`         | Feed and post detail                                                  | public read, verified email for mutation |
| `/network/*`                  | Connections, requests, people discovery                               | authenticated                            |
| `/jobs/*`                     | Job search/detail/saved/apply                                         | mixed public/authenticated               |
| `/applications/*`             | Candidate application tracking                                        | authenticated                            |
| `/companies/*`                | Directory/detail/create/edit/members/billing/recruiting/employer jobs | mixed public/company role                |
| `/messages/*`                 | Inbox/thread/new conversation                                         | authenticated                            |
| `/notifications`              | Notification center                                                   | authenticated                            |
| `/search`                     | Full search                                                           | authenticated                            |
| `/recommendations/*`          | People/jobs/companies recommendations                                 | authenticated                            |
| `/admin/*`                    | Admin users/companies/jobs/outbox/reindex/analytics                   | admin permission                         |
| `/moderation/*`               | Moderation reports/actions                                            | admin or moderator                       |

## API Client Requirements

- Set base URL to `/api/v1`.
- Send bearer access token on authenticated routes.
- Refresh access token with `POST /auth/refresh`; refresh token is read from cookie.
- Retry a failed request exactly once after successful refresh when status is 401.
- Never retry non-idempotent mutations automatically unless request uses an idempotency key.
- Preserve and surface `x-request-id` and `error.requestId`.
- Normalize successful responses to `response.data`; preserve `meta`.
- Normalize validation errors into field-level form errors.
- Use `Idempotency-Key` for `POST /companies`.
- Use request cancellation for search/filter inputs.

## Auth Bootstrap

Current backend has no single bootstrap endpoint. Frontend bootstrap should call these in parallel after access token exists:

- `GET /users/me`
- `GET /profiles/me`
- `GET /notifications/unread-count`

Company memberships, company roles, and admin permissions are not exposed by a single "me" endpoint. Until backend adds one, frontend should derive access lazily from guarded pages:

- Use company detail/member endpoints after user enters a company workspace.
- Treat 403 from admin/company routes as authoritative and show forbidden state.
- Cache discovered company role per company ID.

Recommended backend addition for production-grade bootstrap is listed in [FRONTEND_COMPLETENESS_REVIEW.md](./FRONTEND_COMPLETENESS_REVIEW.md).

## Query Keys And Cache

Use stable query keys so mutations can invalidate exact surfaces.

| Data                         | Query key pattern                   | Invalidate after                         |
| ---------------------------- | ----------------------------------- | ---------------------------------------- |
| Current user                 | `['me']`                            | login, logout, profile/account update    |
| Own profile                  | `['profile', 'me']`                 | profile update, media/avatar update      |
| Member profile               | `['profile', userId]`               | endorsement, connection/follow/block     |
| Home feed                    | `['feed', 'home', filters]`         | create post, hide post, delete post      |
| Post detail                  | `['post', postId]`                  | post/comment/reaction/save/hide mutation |
| Comments                     | `['post-comments', postId]`         | create/update/delete comment             |
| Companies                    | `['companies', filters]`            | company create/update/follow             |
| Company detail               | `['company', companyIdOrSlug]`      | company update/follow/member changes     |
| Jobs                         | `['jobs', filters]`                 | job create/update/publish/close/delete   |
| Job detail                   | `['job', jobId]`                    | job update/save/application submit       |
| Applications                 | `['applications', scope, filters]`  | submit/withdraw/status/note              |
| Conversations                | `['conversations']`                 | create conversation, message new/read    |
| Messages                     | `['messages', conversationId]`      | send message, socket `message:new`       |
| Notifications                | `['notifications', filters]`        | read/read-all/socket notification        |
| Notification count           | `['notifications', 'unread-count']` | read/read-all/socket notification        |
| Search                       | `['search', scope, query, filters]` | no mutation invalidation by default      |
| Recommendations              | `['recommendations', type, cursor]` | connect/save/follow local removal        |
| Billing subscription/invoice | `['billing', companyId, resource]`  | subscription create/cancel               |
| Admin queues                 | `['admin', resource, filters]`      | admin mutations                          |

## Mutation UX Rules

- Optimistic allowed: follow/unfollow, save/unsave job, save/unsave post, reactions, read notification, hide post, typing indicator.
- Optimistic with confirmation: delete post/comment, remove connection, block user, close/delete job, remove member, delete pool.
- No optimistic success: login/register, submit application, update application status, billing subscription, media upload confirm, moderation action, admin status change, reindex, outbox replay.
- Every mutation has disabled pending state and retry path when safe.
- Destructive actions require confirmation with entity name.
- Forms preserve drafts locally for posts, messages, job drafts, profile edits, applications.

## Forms And Validation

Mirror backend DTO constraints:

- Password: 8-128 characters.
- Profile headline max 200; location max 200; website max 500.
- Company name max 200; website max 500; founded year 1800-current year.
- Job title max 255; apply URL max 2048; salary currency exactly 3 characters.
- Cover letter max 20000; screening answers max 50; question max 2000; answer max 10000.
- Messages max 10000.
- Reports/action reasons max 2000.
- Talent pool name max 255; description max 2000.
- Candidate/application notes max 10000.
- Search query max 500; profile search query max 200.

Validation display:

- Inline field errors for DTO validation.
- Form-level error for business/permission failures.
- Request ID shown in expandable details.

## Pagination And Lists

- Use cursor pagination for feed, companies, connections, jobs saved list, applications, messages, notifications, saved candidates, invoices, admin dead letters.
- Use offset only for `GET /profiles/search`.
- Use virtualized lists for long admin, message, feed, and search pages.
- Preserve list scroll position when returning from detail pages.
- Do not client-filter large lists after first page; send filters to backend where supported.

## Realtime

Open sockets only after authenticated session exists.

### `/realtime`

- Connect with `auth.token`.
- Listen for `notification:new`.
- Update notification cache and unread count.
- Show reconnect banner when disconnected.

### `/chat`

- Connect with `auth.token`.
- On thread open, emit `conversation:join`.
- Emit `typing:started` and `typing:stopped` with debounce.
- Emit `message:read` after visible message/read threshold.
- Merge `message:new` into message cache by ID to avoid duplicates.
- Rejoin open conversations after reconnect.

## Media Upload

Shared flow:

1. Client validates size/content type before calling backend.
2. `POST /media/initiate`.
3. Upload file to `uploadUrl`.
4. `POST /media/:id/confirm`.
5. Store `mediaId` in form state.

Rules:

- Current accepted purposes: `avatar`, `resume`, `attachment`.
- Resume UX uses `resume`.
- Generic attachment UX uses `attachment`.
- Company logo/cover and post media should use existing backend accepted purposes until backend adds purpose-specific enum values.
- Hide message attachment UI because `SendMessageDto` currently accepts only `content`.

## Search UX

- Header search opens quick results only for authenticated users.
- Anonymous search entry routes to login or uses public profile search/company/job endpoints where possible.
- Full search page requires bearer token.
- Debounce 300 ms.
- Cancel stale requests.
- Keep query and scope in URL.
- Show separate empty states per result type.

## Role And Permission UX

- Do not rely only on client-side role cache. Backend 403 is final.
- Show company switcher when user reaches company workspace.
- If role unknown, try loading company members or target resource, then degrade to read-only if forbidden.
- Show verified-email banner before actions gated by `EMAIL_NOT_VERIFIED`.
- Hide admin routes unless admin permission has been discovered; direct navigation still calls backend and handles 403.

## Page State Requirements

Every page must include:

- Loading state.
- Empty state.
- Error state with retry and request ID.
- Forbidden state when applicable.
- Offline/reconnecting state for realtime-heavy pages.
- Mobile layout with same core actions.
- Keyboard access for search, composer submit, modal close, menu navigation.

## Performance Rules

- Code split by route group.
- Lazy-load admin, moderation, analytics, billing, recruiting modules.
- Use image lazy-loading and fixed media containers to avoid layout shift.
- Use list virtualization for messages/admin queues if rows exceed 100.
- Use stale-while-revalidate cache for public company/job/post details.
- Keep socket listeners scoped to mounted pages and clean up on unmount.
- Avoid polling notifications/messages when socket is connected.
- Batch visual updates from socket events through query cache updates.

## FE Definition Of Done

- Every endpoint in [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md) has a typed API function.
- Every route in [PAGE_PLAN.md](./PAGE_PLAN.md) has loading/empty/error/forbidden states.
- Every mutation invalidates or updates cache listed above.
- Every auth/company/admin gated route has client guard and server-error fallback.
- Realtime events update cache without duplicate rows.
- Media upload is one shared implementation.
- E2E covers auth, profile, feed, jobs/applications, companies, messaging, notifications, admin/moderation smoke flows.
