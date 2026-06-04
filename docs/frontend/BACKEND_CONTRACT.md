# Backend Contract For Frontend

Source reviewed: `src/**/*.controller.ts`, `src/**/*.dto.ts`, `src/realtime`, `src/infra/config`, `prisma/schema.prisma`, `.env.example`, `docker-compose.yml`.

## Platform Shape

MDC is a professional networking and jobs platform. Backend domains include auth, user/profile, companies, jobs, applications, recruiting, feed/posts/comments/reactions, connections/follows/blocks, messaging, notifications, realtime, search, recommendations, media upload, billing, moderation, admin, analytics, health, and outbox processing.

## HTTP Rules

- API prefix: `/api/v1`
- Prefix exclusions: `GET /`, `GET /health/live`, `GET /health/ready`
- Global auth guard: every route requires bearer auth unless marked `@Public()` or `@OptionalAuth()`.
- Optional auth routes accept anonymous access but can personalize when bearer token is present.
- Global validation: whitelist and transform request DTOs.
- Global CORS: configured by `CORS_ORIGINS`, credentials enabled, max age 86400 seconds.
- Global body limits: `BODY_JSON_LIMIT`, `BODY_URLENCODED_LIMIT`.
- Global rate limit: 300 requests per 60 seconds via Redis throttler.
- Idempotency: company creation uses `Idempotency-Key` behavior through `IdempotentRequest`.
- Request IDs: backend returns `x-request-id`; errors include `requestId`.
- Webhooks bypass response wrapping.

## Auth And Session

- Register/login return `accessToken` and set `refreshToken` cookie.
- Refresh reads `refreshToken` cookie and rotates refresh token family.
- Logout revokes current refresh token and clears cookie.
- Refresh cookie options: `httpOnly`, `secure` from `COOKIE_SECURE`, `sameSite` from `COOKIE_SAME_SITE`, path `/api/v1/auth`.
- Access token auth: `Authorization: Bearer <accessToken>`.
- Public auth routes: register, login, refresh, verify email, resend verification, password reset request, password reset confirm.

## Response Shapes

```ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};
```

Pagination is cursor-first. Common query DTO: `cursor?: string`, `limit: number` with backend max 100 unless endpoint sets a smaller max.

## Endpoint Inventory

All routes below use `/api/v1` unless marked as prefix-excluded.

### System

| Method | Path            | Auth              | Purpose                                                             |
| ------ | --------------- | ----------------- | ------------------------------------------------------------------- |
| GET    | `/`             | Public, no prefix | Root hello                                                          |
| GET    | `/health/live`  | Public, no prefix | Liveness                                                            |
| GET    | `/health/ready` | Public, no prefix | Readiness across database, Redis, S3, Elasticsearch, mailer, outbox |

### Auth

| Method | Path                           | Auth          | Body/query                          | Purpose                                        |
| ------ | ------------------------------ | ------------- | ----------------------------------- | ---------------------------------------------- |
| POST   | `/auth/register`               | Public        | `email`, `password`, `displayName?` | Create user and send verification              |
| POST   | `/auth/login`                  | Public        | `email`, `password`                 | Login, return access token, set refresh cookie |
| POST   | `/auth/refresh`                | Public cookie | refresh cookie                      | Rotate refresh/access token                    |
| POST   | `/auth/logout`                 | Bearer        | refresh cookie                      | Revoke refresh token and clear cookie          |
| POST   | `/auth/verify-email`           | Public        | `token`                             | Verify email                                   |
| POST   | `/auth/resend-verification`    | Public        | `email`                             | Resend verification email                      |
| POST   | `/auth/password-reset/request` | Public        | `email`                             | Send reset email                               |
| POST   | `/auth/password-reset/confirm` | Public        | `token`, `newPassword`              | Reset password                                 |

Rate limits: register 3/min, login 5/min, refresh 10/min, resend verification 1/min, password reset request/confirm 3 per 5 minutes.

### Users And Profiles

| Method | Path                                        | Auth   | Body/query                                                                  | Purpose                      |
| ------ | ------------------------------------------- | ------ | --------------------------------------------------------------------------- | ---------------------------- |
| GET    | `/users/me`                                 | Bearer | none                                                                        | Current user account summary |
| PATCH  | `/users/me`                                 | Bearer | `displayName?`                                                              | Update display name          |
| GET    | `/users/:id`                                | Bearer | none                                                                        | User summary by ID           |
| GET    | `/profiles/me`                              | Bearer | none                                                                        | Current profile              |
| PATCH  | `/profiles/me`                              | Bearer | profile fields, nested skills/experience/education/certifications/languages | Update current profile       |
| GET    | `/profiles/search`                          | Public | `q`, `limit?`, `offset?`                                                    | Search profiles              |
| GET    | `/profiles/:userId`                         | Bearer | none                                                                        | Profile detail               |
| POST   | `/profiles/:userId/skills/:skillId/endorse` | Bearer | none                                                                        | Endorse skill                |
| DELETE | `/profiles/:userId/skills/:skillId/endorse` | Bearer | none                                                                        | Remove endorsement           |

Profile update rate limit: 10/min.

### Companies

| Method | Path                                      | Auth                       | Body/query                     | Purpose                    |
| ------ | ----------------------------------------- | -------------------------- | ------------------------------ | -------------------------- |
| POST   | `/companies`                              | Bearer                     | `CreateCompanyDto`             | Create company; idempotent |
| GET    | `/companies`                              | Public                     | `limit?`, `cursor?`, `search?` | Company directory          |
| GET    | `/companies/:id`                          | Public                     | none                           | Company detail by ID       |
| GET    | `/companies/by-slug/:slug`                | Public                     | none                           | Company detail by slug     |
| PATCH  | `/companies/:id`                          | Company OWNER/ADMIN        | company profile/media fields   | Update company             |
| POST   | `/companies/:id/follow`                   | Bearer                     | none                           | Follow company             |
| DELETE | `/companies/:id/follow`                   | Bearer                     | none                           | Unfollow company           |
| POST   | `/companies/:id/members`                  | Company OWNER/ADMIN        | `userId`, `role`               | Add member                 |
| GET    | `/companies/:id/members`                  | Company OWNER/ADMIN/MEMBER | pagination/search              | List members               |
| PATCH  | `/companies/:id/members/:memberId`        | Company OWNER/ADMIN        | `role`                         | Change member role         |
| DELETE | `/companies/:id/members/:memberId`        | Company OWNER/ADMIN        | none                           | Remove member              |
| POST   | `/companies/:id/members/invite`           | Company OWNER/ADMIN        | `email`, `role`                | Invite member              |
| POST   | `/companies/invitations/accept`           | Bearer                     | `token`                        | Accept invitation          |
| POST   | `/companies/:id/recruiter-seats/allocate` | Company OWNER/ADMIN        | `userId`                       | Allocate recruiter seat    |
| DELETE | `/companies/:id/recruiter-seats/:seatId`  | Company OWNER/ADMIN        | none                           | Deallocate recruiter seat  |

### Jobs

| Method | Path                             | Auth                    | Body/query        | Purpose                    |
| ------ | -------------------------------- | ----------------------- | ----------------- | -------------------------- |
| POST   | `/jobs`                          | Bearer + verified email | `CreateJobDto`    | Create draft job           |
| GET    | `/jobs`                          | Public                  | filters           | Job search/list            |
| GET    | `/jobs/saved`                    | Bearer                  | cursor pagination | Saved jobs                 |
| GET    | `/jobs/:id`                      | Public                  | none              | Job detail                 |
| PATCH  | `/jobs/:id`                      | Bearer company manager  | `UpdateJobDto`    | Edit job                   |
| POST   | `/jobs/:id/publish`              | Bearer + verified email | none              | Publish job                |
| POST   | `/jobs/:id/close`                | Bearer company manager  | none              | Close job                  |
| DELETE | `/jobs/:id`                      | Bearer company manager  | none              | Delete job                 |
| POST   | `/jobs/:id/save`                 | Bearer                  | none              | Save job                   |
| DELETE | `/jobs/:id/save`                 | Bearer                  | none              | Unsave job                 |
| POST   | `/jobs/:id/external-apply-click` | Public                  | none              | Track external apply click |

Job filters: `companyId?`, `status?`, `employmentType?`, `workplaceType?`, `location?`, `skillId?`, `q?`.

### Applications

| Method | Path                           | Auth                      | Body/query                                             | Purpose                           |
| ------ | ------------------------------ | ------------------------- | ------------------------------------------------------ | --------------------------------- |
| POST   | `/jobs/:jobId/applications`    | Bearer                    | cover letter, screening answers, resume media asset ID | Submit application                |
| GET    | `/jobs/:jobId/applications`    | Bearer employer           | cursor pagination                                      | List applications for job         |
| GET    | `/applications/me`             | Bearer                    | cursor pagination                                      | Applicant's applications          |
| GET    | `/applications/:id`            | Bearer applicant/employer | none                                                   | Application detail                |
| PATCH  | `/applications/:id/status`     | Bearer employer           | `newStatus`, `reason?`                                 | Move application through pipeline |
| POST   | `/applications/:id/withdraw`   | Bearer applicant          | none                                                   | Withdraw application              |
| POST   | `/applications/:id/notes`      | Bearer employer           | `content`                                              | Add internal note                 |
| GET    | `/applications/:id/notes`      | Bearer employer           | none                                                   | List internal notes               |
| GET    | `/applications/:id/resume-url` | Bearer applicant/employer | none                                                   | Presigned resume URL              |

Status values: `SUBMITTED`, `REVIEWED`, `INTERVIEWING`, `OFFER`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`.

### Feed, Posts, Comments, Reactions

| Method | Path                       | Auth                    | Body/query                                 | Purpose             |
| ------ | -------------------------- | ----------------------- | ------------------------------------------ | ------------------- |
| GET    | `/feed/home`               | Public                  | cursor pagination                          | Home feed           |
| GET    | `/feed/profile/:userId`    | Public                  | cursor pagination                          | Profile feed        |
| GET    | `/feed/company/:companyId` | Public                  | cursor pagination                          | Company feed        |
| GET    | `/feed/hashtag/:tag`       | Public                  | cursor pagination                          | Hashtag feed        |
| POST   | `/posts`                   | Bearer + verified email | `content`, `visibility?`, `mediaAssetIds?` | Create post         |
| GET    | `/posts/:id`               | Public                  | none                                       | Post detail         |
| PATCH  | `/posts/:id`               | Bearer + verified email | `content?`, `visibility?`                  | Edit post           |
| DELETE | `/posts/:id`               | Bearer + verified email | none                                       | Delete post         |
| GET    | `/posts/:id/comments`      | Public                  | cursor pagination                          | List comments       |
| POST   | `/posts/:id/comments`      | Bearer + verified email | `content`, `parentId?`                     | Add comment/reply   |
| PATCH  | `/posts/comments/:id`      | Bearer + verified email | `content`                                  | Edit comment        |
| DELETE | `/posts/comments/:id`      | Bearer + verified email | none                                       | Delete comment      |
| POST   | `/posts/:id/reactions`     | Bearer + verified email | `type`                                     | Add/update reaction |
| DELETE | `/posts/reactions/:id`     | Bearer + verified email | none                                       | Remove reaction     |
| POST   | `/posts/:id/save`          | Bearer + verified email | none                                       | Save post           |
| DELETE | `/posts/:id/save`          | Bearer + verified email | none                                       | Unsave post         |
| POST   | `/posts/:id/hide`          | Bearer + verified email | none                                       | Hide post           |
| DELETE | `/posts/:id/hide`          | Bearer + verified email | none                                       | Unhide post         |

Create limits: posts 5/min, comments 10/min, reactions 30/min.

### Connections, Follows, Blocks

| Method | Path                       | Auth   | Body/query        | Purpose                            |
| ------ | -------------------------- | ------ | ----------------- | ---------------------------------- |
| POST   | `/connections`             | Bearer | `toUserId`        | Send connection request            |
| GET    | `/connections`             | Bearer | cursor pagination | Accepted connections               |
| GET    | `/connections/pending`     | Bearer | cursor pagination | Pending incoming/outgoing requests |
| PATCH  | `/connections/:id/accept`  | Bearer | none              | Accept request                     |
| PATCH  | `/connections/:id/decline` | Bearer | none              | Decline request                    |
| DELETE | `/connections/:id`         | Bearer | none              | Remove connection                  |
| POST   | `/users/:id/follow`        | Bearer | none              | Follow user                        |
| DELETE | `/users/:id/follow`        | Bearer | none              | Unfollow user                      |
| POST   | `/users/:id/block`         | Bearer | none              | Block user                         |
| DELETE | `/users/:id/block`         | Bearer | none              | Unblock user                       |

### Messaging

| Method | Path                          | Auth                    | Body/query                        | Purpose                       |
| ------ | ----------------------------- | ----------------------- | --------------------------------- | ----------------------------- |
| POST   | `/conversations`              | Bearer + verified email | `participantIds` exactly one user | Start direct conversation     |
| POST   | `/conversations/recruiting`   | Bearer + verified email | `candidateUserId`                 | Start recruiting conversation |
| GET    | `/conversations`              | Bearer                  | cursor pagination                 | Conversation list             |
| GET    | `/conversations/:id`          | Bearer participant      | none                              | Conversation detail           |
| POST   | `/conversations/:id/messages` | Bearer + verified email | `content`                         | Send message                  |
| GET    | `/conversations/:id/messages` | Bearer participant      | cursor pagination                 | Message history               |
| PATCH  | `/conversations/:id/read`     | Bearer participant      | none                              | Mark conversation read        |

Message send limit: 30/min.

### Notifications

| Method | Path                          | Auth   | Body/query         | Purpose                    |
| ------ | ----------------------------- | ------ | ------------------ | -------------------------- |
| GET    | `/notifications`              | Bearer | `cursor?`, `limit` | Notification list          |
| GET    | `/notifications/unread-count` | Bearer | none               | Unread count               |
| PATCH  | `/notifications/:id/read`     | Bearer | none               | Mark one notification read |
| POST   | `/notifications/read-all`     | Bearer | none               | Mark all read              |
| GET    | `/notifications/preferences`  | Bearer | none               | Preference flags           |
| PUT    | `/notifications/preferences`  | Bearer | boolean flags      | Update preferences         |

Preference flags: `newMessage`, `connectionRequest`, `connectionAccepted`, `applicationStatusChange`, `jobRecommendation`, `postInteraction`.

### Media Upload

| Method | Path                 | Auth            | Body/query                                        | Purpose                                      |
| ------ | -------------------- | --------------- | ------------------------------------------------- | -------------------------------------------- |
| POST   | `/media/initiate`    | Bearer          | `purpose`, `filename`, `contentType`, `sizeBytes` | Create media record and presigned upload URL |
| POST   | `/media/:id/confirm` | Bearer          | none                                              | Mark uploaded asset ready                    |
| GET    | `/media/:id`         | Optional bearer | none                                              | Get presigned download URL when authorized   |
| DELETE | `/media/:id`         | Bearer owner    | none                                              | Delete asset                                 |

Supported upload purposes: `avatar`, `resume`, `attachment`. Allowed content types and max sizes are configured by env.

### Search

| Method | Path                | Auth                  | Body/query             | Purpose             |
| ------ | ------------------- | --------------------- | ---------------------- | ------------------- |
| GET    | `/search`           | Bearer                | `q`, `type?`, `limit?` | Federated search    |
| GET    | `/search/users`     | Bearer                | `q`, `limit?`          | User/profile search |
| GET    | `/search/companies` | Bearer                | `q`, `limit?`          | Company search      |
| GET    | `/search/jobs`      | Bearer                | `q`, `limit?`          | Job search          |
| GET    | `/search/posts`     | Bearer                | `q`, `limit?`          | Post search         |
| POST   | `/search/reindex`   | Admin + `MANAGE_JOBS` | `entityType` query     | Trigger reindex     |

Search entity types: `users`, `companies`, `jobs`, `posts`.

### Recommendations

| Method | Path                         | Auth   | Body/query              | Purpose                 |
| ------ | ---------------------------- | ------ | ----------------------- | ----------------------- |
| GET    | `/recommendations/people`    | Bearer | `limit?`, cursor fields | People recommendations  |
| GET    | `/recommendations/jobs`      | Bearer | `limit?`, cursor fields | Job recommendations     |
| GET    | `/recommendations/companies` | Bearer | `limit?`, cursor fields | Company recommendations |

Each recommendation route is limited to 30/min.

### Recruiting

All routes are scoped to `/companies/:companyId` and require a company recruiting role in service policy.

| Method | Path                                                                     | Auth                     | Body/query                              | Purpose                    |
| ------ | ------------------------------------------------------------------------ | ------------------------ | --------------------------------------- | -------------------------- |
| POST   | `/companies/:companyId/saved-candidates`                                 | Bearer company recruiter | `candidateUserId`, `sourceId?`, `note?` | Save candidate             |
| DELETE | `/companies/:companyId/saved-candidates/:candidateUserId`                | Bearer company recruiter | none                                    | Unsave candidate           |
| GET    | `/companies/:companyId/saved-candidates`                                 | Bearer company recruiter | cursor pagination                       | Saved candidates           |
| POST   | `/companies/:companyId/talent-pools`                                     | Bearer company recruiter | `name`, `description?`                  | Create pool                |
| GET    | `/companies/:companyId/talent-pools`                                     | Bearer company recruiter | none                                    | List pools                 |
| PATCH  | `/companies/:companyId/talent-pools/:poolId`                             | Bearer company recruiter | `name?`, `description?`                 | Edit pool                  |
| DELETE | `/companies/:companyId/talent-pools/:poolId`                             | Bearer company recruiter | none                                    | Delete pool                |
| POST   | `/companies/:companyId/talent-pools/:poolId/candidates`                  | Bearer company recruiter | `candidateUserId`                       | Add candidate to pool      |
| DELETE | `/companies/:companyId/talent-pools/:poolId/candidates/:candidateUserId` | Bearer company recruiter | none                                    | Remove candidate from pool |

### Billing

| Method | Path                                        | Auth                           | Body/query        | Purpose                                         |
| ------ | ------------------------------------------- | ------------------------------ | ----------------- | ----------------------------------------------- |
| GET    | `/billing/plans`                            | Optional bearer                | none              | Public plan list, personalized if authenticated |
| GET    | `/billing/plans/:planId`                    | Public                         | none              | Plan detail                                     |
| POST   | `/admin/billing/plans`                      | Admin                          | plan fields       | Create plan                                     |
| PATCH  | `/admin/billing/plans/:planId`              | Admin                          | plan fields       | Update plan                                     |
| POST   | `/companies/:companyId/subscription`        | Company OWNER + verified email | `planId`          | Create subscription                             |
| GET    | `/companies/:companyId/subscription`        | OWNER/ADMIN/BILLING_ADMIN      | none              | Current subscription                            |
| DELETE | `/companies/:companyId/subscription`        | Company OWNER                  | none              | Cancel subscription                             |
| GET    | `/companies/:companyId/invoices`            | OWNER/ADMIN/BILLING_ADMIN      | cursor pagination | Invoice list                                    |
| GET    | `/companies/:companyId/invoices/:invoiceId` | OWNER/ADMIN/BILLING_ADMIN      | none              | Invoice detail                                  |
| POST   | `/billing/webhooks/:provider`               | Public + signature guard       | provider payload  | Payment webhook                                 |

### Moderation

| Method | Path                            | Auth                                 | Body/query                                       | Purpose                         |
| ------ | ------------------------------- | ------------------------------------ | ------------------------------------------------ | ------------------------------- |
| POST   | `/moderation/reports`           | Bearer                               | target entity, target ID, category, description? | Report content/user/company/job |
| GET    | `/moderation/reports`           | Admin/moderator + `MODERATE_CONTENT` | `status?`                                        | Queue                           |
| PATCH  | `/moderation/reports/:id/claim` | Admin/moderator + `MODERATE_CONTENT` | none                                             | Claim report                    |
| POST   | `/moderation/actions`           | Admin/moderator + `MODERATE_CONTENT` | action type, target, reason, duration?           | Apply action                    |

Report create rate limit: 5 per 10 minutes.

### Admin

All admin routes require bearer auth, role `admin`, and permission metadata.

| Method | Path                                   | Permission         | Purpose                        |
| ------ | -------------------------------------- | ------------------ | ------------------------------ |
| GET    | `/admin/users`                         | `MANAGE_USERS`     | User list/filter               |
| PATCH  | `/admin/users/:id/status`              | `MANAGE_USERS`     | Change user status with reason |
| GET    | `/admin/companies`                     | `MANAGE_COMPANIES` | Company list/filter            |
| PATCH  | `/admin/companies/:id/verification`    | `MANAGE_COMPANIES` | Verify company                 |
| GET    | `/admin/jobs`                          | `MANAGE_JOBS`      | Job list/filter                |
| GET    | `/admin/outbox/dead-letter`            | `MANAGE_ADMINS`    | Dead-letter queue              |
| POST   | `/admin/outbox/dead-letter/:id/replay` | `MANAGE_ADMINS`    | Replay failed outbox event     |

### Analytics

| Method | Path                          | Auth                     | Body/query                         | Purpose                        |
| ------ | ----------------------------- | ------------------------ | ---------------------------------- | ------------------------------ |
| POST   | `/analytics/events`           | Optional bearer          | `eventType`, `targetId`, `source?` | Record product analytics event |
| GET    | `/analytics/dashboard`        | Admin + `VIEW_ANALYTICS` | none                               | Platform dashboard             |
| GET    | `/analytics/entity/:type/:id` | Admin + `VIEW_ANALYTICS` | none                               | Entity analytics               |

Event record rate limit: 60/min.

## Realtime Contract

### `/realtime` namespace

- Transport: websocket only.
- Auth: `handshake.auth.token` or `Authorization: Bearer <token>` header.
- Connection joins room `user:<userId>`.
- Presence stored in Redis under `presence:user:<userId>` with 60 second TTL; gateway refreshes every 30 seconds.
- Server emits `notification:new` with notification event payload.

### `/chat` namespace

- Transport: websocket only.
- Auth: same token extraction as `/realtime`.
- Client emits:
  - `conversation:join` with `{ conversationId }`; server verifies active participant and joins `conversation:<id>`.
  - `typing:started` with `{ conversationId }`; server broadcasts to conversation room.
  - `typing:stopped` with `{ conversationId }`; server broadcasts to conversation room.
  - `message:read` with `{ messageId, conversationId }`; server broadcasts read state.
- Server emits:
  - `message:new`
  - `typing:started`
  - `typing:stopped`
  - `message:read`
  - `exception` for websocket errors.

## Core Enums

- User: `ACTIVE`, `DISABLED`, `DELETED`, `SUSPENDED`
- Profile visibility: `PUBLIC`, `CONNECTIONS_ONLY`, `PRIVATE`
- Company role: `OWNER`, `ADMIN`, `MEMBER`, `BILLING_ADMIN`
- Job: `DRAFT`, `PUBLISHED`, `CLOSED`, `DELETED`; apply mode `INTERNAL`, `EXTERNAL`, `HYBRID`; employment `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP`, `TEMPORARY`; workplace `ONSITE`, `HYBRID`, `REMOTE`
- Application: `SUBMITTED`, `REVIEWED`, `INTERVIEWING`, `OFFER`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`
- Connection: `PENDING`, `ACCEPTED`, `DECLINED`, `REMOVED`
- Post visibility: `PUBLIC`, `CONNECTIONS`, `PRIVATE`
- Reaction: `LIKE`, `CELEBRATE`, `SUPPORT`, `LOVE`, `INSIGHTFUL`, `CURIOUS`
- Media: `PENDING`, `READY`, `QUARANTINED`, `DELETED`; visibility `PRIVATE`, `CONNECTIONS_ONLY`, `PUBLIC`
- Report entity: `POST`, `COMMENT`, `MESSAGE`, `PROFILE`, `COMPANY`, `JOB`
- Report status: `PENDING`, `UNDER_REVIEW`, `RESOLVED_ACTIONED`, `RESOLVED_DISMISSED`
- Moderation action: `WARN`, `REMOVE_CONTENT`, `SUSPEND_USER`, `BAN_USER`, `DISMISS`
- Admin role: `SUPER_ADMIN`, `ADMIN`, `MODERATOR`
- Admin permissions: `MANAGE_USERS`, `MANAGE_COMPANIES`, `MANAGE_JOBS`, `MODERATE_CONTENT`, `VIEW_ANALYTICS`, `MANAGE_ADMINS`

## Data Domains

- Identity: `User`, `RefreshToken`, `VerificationToken`, `UserPreference`, `NotificationPreference`
- Audit/outbox: `AuditLog`, `OutboxEvent`, `OutboxDeadLetter`, `IdempotencyKey`
- Profile graph: `Profile`, `ProfileSkill`, `Skill`, `Experience`, `Education`, `Certification`, `ProfileLanguage`, `Endorsement`
- Company graph: `Company`, `CompanyMember`, `CompanyFollower`, `CompanyVerification`, `RecruiterSeat`, `MemberInvitation`
- Billing: `BillingPlan`, `Subscription`, `EntitlementGrant`, `CreditTransaction`, `Invoice`, `InvoiceLineItem`, `PaymentProviderEvent`
- Jobs/applications: `Job`, `JobSkill`, `SavedJob`, `JobView`, `Application`, `ApplicationAnswer`, `ApplicationAttachment`, `ApplicationStatusEvent`, `ApplicationNote`
- Recruiting: `CandidateSource`, `SavedCandidate`, `TalentPool`, `TalentPoolCandidate`, `CandidateNote`
- Social: `Connection`, `Follow`, `Block`, `Post`, `Comment`, `Reaction`, `Hashtag`, `PostHashtag`, `PostMedia`, `SavedPost`, `HiddenPost`, `Mention`
- Messaging: `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment`, `MessageReadState`
- Notification/realtime: `Notification`, `RealtimeDeliveryReceipt`, `UserDevice`
- Search/recommendations: `SearchQueryLog`, `SearchReindexRun`, `RecommendationFeedback`, `RecommendationDismissal`
- Moderation/admin/analytics: `Report`, `ModerationAction`, `AdminUser`, `AdminPermission`, `ProfileView`, `CompanyView`, `PostImpression`, `SlottedCounter`, `AnalyticsDailyAggregate`

## Runtime Settings

### Required app settings

- `NODE_ENV`: `development`, `test`, `production`
- `PORT`: 1-65535
- `CORS_ORIGINS`: comma-separated origins
- `BODY_JSON_LIMIT`, `BODY_URLENCODED_LIMIT`: values like `1mb`, `512kb`, `1024b`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`, `COOKIE_SECRET`
- `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`
- `ELASTICSEARCH_NODE`
- `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM`
- `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`
- `BILLING_WEBHOOK_SECRET`
- Health timeout settings for database, Redis, S3, Elasticsearch, mailer

### Defaults and optional settings

- `APP_PROCESS_ROLE`: `api`, `worker`, `realtime`, `all`; default `all`
- Prisma transaction max wait: 5000 ms
- Prisma transaction timeout: 15000 ms
- Outbox: batch 20, max retries 5, base backoff 1000 ms, max backoff 60000 ms, lease timeout 60000 ms, health lag threshold 100
- JWT access expiry: 15 minutes
- JWT refresh expiry: 7 days
- Cookie same-site default: `lax`
- Media avatar max: 5 MB
- Media resume max: 20 MB
- Media allowed types default: JPEG, PNG, GIF, WebP, PDF
- Billing provider default: `mock`
- Default free plan slug: `free`

### Local infrastructure

`docker-compose.yml` starts:

- PostgreSQL 16 on `${POSTGRES_PORT:-5432}`
- Redis 7 on `${REDIS_PORT:-6379}`
- MinIO on `${MINIO_PORT:-9000}` and console `${MINIO_CONSOLE_PORT:-9001}`
- Elasticsearch 8.17 on `${ELASTICSEARCH_PORT:-9200}`

## Frontend Performance Constraints

- Use cursor pagination and infinite-scroll/page controls for feed, jobs, applications, messages, notifications, connections, saved candidates, invoices, and admin queues.
- Debounce search/profile/company/job filters before calling backend.
- Cache public detail pages by ID/slug with short stale time; invalidate after save/follow/apply/edit actions.
- Use WebSocket updates for notifications, messages, typing, and read receipts instead of polling where connected.
- Centralize auth refresh and retry exactly once after access-token expiration.
- Centralize media upload: initiate, upload directly to S3/MinIO with presigned URL, confirm, then attach media asset ID to domain request.
- Keep admin/recruiting lists server-driven; avoid client-side filtering over large datasets.
