# Frontend Page Plan

Goal: build a full product UI around the current backend contract without specifying visual styling. Pages are grouped by user workflow and route ownership. Each page lists required content, controls, backend data, and UX/performance behavior.

## App Shell

### Global Layout

- Top navigation with product mark, global search, primary sections, create post/job shortcuts, message icon, notification icon, user menu.
- Responsive side navigation for authenticated users: Feed, Network, Jobs, Messages, Notifications, Profile, Companies, Recruiting/Admin when available.
- Auth-aware route guards:
  - Anonymous can view public feed/company/job/post surfaces and profile search.
  - Authenticated users are required for full profile detail and global search endpoints.
  - Authenticated unverified users can browse but see verification prompts before posting, messaging, creating jobs, and subscription actions.
  - Company roles unlock company management, jobs, recruiting, billing.
  - Admin/moderator roles unlock admin, moderation, analytics, reindex, outbox.
- Global API state: access token, refresh flow, current user, unread notifications, active company context, role/permission cache.
- Global feedback: toast/error area, request ID in error detail drawer, loading skeletons, empty states, retry buttons.

### Global Search

- Command/search input available from shell.
- Search scopes: All, People, Companies, Jobs, Posts.
- Results preview dropdown with keyboard navigation and "View all results".
- Full submit routes to Search Results page.
- Backend: `GET /search`, `/search/users`, `/search/companies`, `/search/jobs`, `/search/posts`.
- Auth: bearer token required by current backend search routes.
- Performance: 300 ms debounce, cancel stale requests, keep recent searches local.

## Public And Auth Pages

### Landing / Public Home

- Shows public home feed, job search entry, company search entry, sign-in/register actions.
- Sections: trending posts, recently published jobs, company discovery, value prompts for authenticated actions.
- Backend: `GET /feed/home`, `GET /jobs`, `GET /companies`, optional `GET /billing/plans`.
- UX: anonymous users can read public items; gated actions open auth modal preserving intended action.

### Login

- Fields: email, password, remember device text if supported by client only.
- Actions: login, forgot password, register, resend verification after relevant error.
- Backend: `POST /auth/login`; refresh cookie set by backend.
- UX: redirect to previous intended page; show email verification banner if user is unverified.

### Register

- Fields: email, display name, password, confirm password, terms checkbox if product requires it.
- Backend: `POST /auth/register`.
- Post-submit: show "check email" state with resend control.
- Performance: client-side password validation before submit.

### Email Verification

- URL token page validates token.
- States: verifying, success, expired/invalid, resend form.
- Backend: `POST /auth/verify-email`, `POST /auth/resend-verification`.
- UX: auto-redirect to onboarding/profile after success.

### Forgot Password

- Step 1: request reset by email.
- Step 2: confirm reset from token URL with new password and confirm password.
- Backend: `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`.
- UX: same success copy regardless of email existence.

### Logout

- No full page unless route-based logout is needed.
- Backend: `POST /auth/logout`.
- UX: clear local access token and cached private data after server response or terminal auth failure.

## Onboarding And Account

### Profile Onboarding

- Triggered after registration or first login when profile is sparse.
- Sections: headline, location, about, open to work, recruiting eligible, visibility.
- Repeatable blocks: skills, experience, education, certifications, languages.
- Backend: `PATCH /profiles/me`.
- UX: save draft locally; submit as one profile update; allow skip.

### My Profile

- Public-preview profile with owner controls.
- Content: user identity, headline, about, location, website, skills with endorsements, experience, education, certifications, languages, posts.
- Actions: edit profile, upload avatar, endorse/remove endorsement on others, message/connect/follow/block depending relationship.
- Backend: `GET /profiles/me`, `GET /profiles/:userId`, `GET /feed/profile/:userId`, `POST/DELETE /profiles/:userId/skills/:skillId/endorse`, media upload.
- Performance: split profile details and profile feed queries; lazy-load long sections.

### Member Profile Detail

- Authenticated view of another member's profile; current backend requires bearer auth for `GET /profiles/:userId`.
- Content: same public-facing fields as My Profile, read-only where viewer is not owner.
- Actions: connect, follow/unfollow, message, endorse/remove endorsement, block, report.
- Backend: `GET /profiles/:userId`, relationship endpoints, endorsement endpoints, `GET /feed/profile/:userId`.
- UX: anonymous profile-card clicks route to login while preserving destination.

### Edit Profile

- Form with same fields as onboarding plus media/avatar flow.
- Nested list editors for skills, experience, education, certifications, languages.
- Backend: `PATCH /profiles/me`, `POST /media/initiate`, direct upload, `POST /media/:id/confirm`.
- UX: dirty-state guard, optimistic section preview, validation matching DTO lengths.

### Account Settings

- Sections: display name, email status, password reset entry point, session logout.
- Backend: `GET /users/me`, `PATCH /users/me`, auth reset/logout routes.
- UX: show immutable email unless backend later supports email change.

### Notification Settings

- Toggles: new messages, connection requests, connection accepted, application status changes, job recommendations, post interactions.
- Backend: `GET /notifications/preferences`, `PUT /notifications/preferences`.
- UX: optimistic toggle with rollback on failure.

## Feed And Social

### Home Feed

- Content: composer, feed filter/sort if supported client-side, post list, recommendations rail, notification prompt.
- Post card elements: author, timestamp, visibility, content, media, hashtags, mention links, reaction summary, comment count, save/hide/report menu.
- Backend: `GET /feed/home`, `POST /posts`, `POST /media/initiate`, `POST /media/:id/confirm`.
- UX: cursor infinite scroll, skeleton cards, optimistic post insert after creation.

### Post Detail

- Content: full post, comments thread, reply composer, related author/company/profile actions.
- Backend: `GET /posts/:id`, `GET /posts/:id/comments`, comment/reaction/save/hide/report endpoints.
- UX: optimistic reaction/comment, keep replies grouped by parent when `parentId` exists.

### Create/Edit Post

- Composer with content textarea, visibility selector, media attachments, mentioned users/hashtags text parsing.
- Backend: `POST /posts`, `PATCH /posts/:id`, media endpoints.
- Validation: content required, media asset IDs only after confirm.
- UX: disable submit while upload pending.

### Hashtag Feed

- Header with hashtag name and feed list.
- Backend: `GET /feed/hashtag/:tag`.
- UX: route from hashtag clicks; same post-card interactions as home feed.

### Report Content Modal

- Entity-aware modal for post, comment, message, profile, company, job.
- Fields: category, optional description.
- Backend: `POST /moderation/reports`.
- UX: rate-limit aware; hide report action for own content if product chooses.

## Network

### Network Dashboard

- Sections: pending requests, accepted connections, suggested people, followers/following summary if derived in UI.
- Backend: `GET /connections`, `GET /connections/pending`, `GET /recommendations/people`.
- Actions: accept, decline, remove, follow, unfollow, block.
- UX: optimistic accept/decline with rollback.

### People Search

- Search field and filters based on profile data: location, skills, open to work if represented by query.
- Backend: `GET /profiles/search`, `GET /search/users`.
- Result card: name/display name, headline, location, mutual signal if present, connect/follow/message.
- Performance: debounce and pagination.

### Connection Requests

- Dedicated queue for incoming/outgoing pending requests.
- Backend: `GET /connections/pending`, `PATCH /connections/:id/accept`, `PATCH /connections/:id/decline`.
- UX: batch triage-friendly layout, undo only while request is pending locally.

### Blocked/Relationship Controls

- Accessible from profile action menu and settings if client stores a local list.
- Backend: `POST /users/:id/block`, `DELETE /users/:id/block`.
- UX: confirm destructive social action; hide blocked users from local lists after success.

## Jobs And Applicant Workflow

### Job Search

- Search/filter form: keyword, company, employment type, workplace type, location, skill.
- Results list/card: title, company, location, workplace, employment, salary if present, status, save action.
- Backend: `GET /jobs`, `GET /search/jobs`, `POST/DELETE /jobs/:id/save`.
- Performance: URL-synced filters, debounce keyword, cursor pagination.

### Job Detail

- Content: title, company, status, description, employment/workplace/location, salary, skills, apply mode.
- Actions: internal apply, external apply, save/unsave, report, company link.
- Backend: `GET /jobs/:id`, `POST /jobs/:id/save`, `DELETE /jobs/:id/save`, `POST /jobs/:id/external-apply-click`.
- UX: if `applyMode` is `EXTERNAL`, track click before opening URL; if `INTERNAL` or `HYBRID`, route to application form.

### Apply To Job

- Form: resume upload/select, cover letter, screening answers.
- Backend: `POST /jobs/:jobId/applications`, media upload for resume.
- UX: show upload progress, autosave cover letter locally, prevent duplicate submit while request pending.

### My Applications

- List with filters: status, date, company/job keyword.
- Backend: `GET /applications/me`.
- Cards: job, company, current status, submitted/updated time, next action.
- UX: status timeline opens detail drawer.

### Application Detail

- Applicant view: submitted content, resume link, status timeline, withdraw action.
- Employer view: applicant profile, answers, resume URL, notes, status controls.
- Backend: `GET /applications/:id`, `GET /applications/:id/resume-url`, `POST /applications/:id/withdraw`, `PATCH /applications/:id/status`, notes endpoints.
- UX: state transition controls should only show valid next statuses; reject/withdraw confirms before submit.

### Saved Jobs

- List saved jobs with remove action.
- Backend: `GET /jobs/saved`, `DELETE /jobs/:id/save`.
- UX: empty state routes to Job Search.

## Companies

### Company Directory

- Searchable list of companies.
- Backend: `GET /companies`.
- Card: name, industry, verified badge, headquarters, employee count, follower count, follow action.
- Performance: cursor pagination and cached company cards.

### Company Detail

- Content: profile header, about, jobs, posts/feed, members preview, verification state.
- Backend: `GET /companies/:id` or `/companies/by-slug/:slug`, `GET /feed/company/:companyId`, `GET /jobs?companyId=...`, follow/unfollow.
- Role-aware controls: edit, manage members, jobs, recruiting, billing, analytics.

### Create Company

- Fields: name, industry, description, website, employee count, founded year, headquarters.
- Backend: `POST /companies`.
- UX: use idempotency key per submit; route to company setup after success.

### Edit Company

- Same core profile fields plus logo/cover media upload.
- Backend: `PATCH /companies/:id`, media endpoints.
- UX: show member role requirement; preserve unsaved changes.

### Company Members

- Table: user, role, title/status if returned, joined date, actions.
- Actions: add member by user ID, invite by email, change role, remove member.
- Backend: member and invitation endpoints.
- UX: prevent removing last owner in UI if backend surfaces enough data; otherwise show confirm.

### Company Invitations

- Accept invitation route from email token.
- Backend: `POST /companies/invitations/accept`.
- UX: require login first, preserve token through auth flow.

### Recruiter Seats

- Content: allocated seats, available seats if entitlement data available, allocate/deallocate.
- Backend: `/companies/:id/recruiter-seats/allocate`, delete seat.
- UX: user picker limited to company members where possible.

## Employer Jobs And Applications

### Employer Job Dashboard

- Company-scoped job table with status tabs: draft, published, closed, deleted.
- Backend: `GET /jobs?companyId=...`, `POST /jobs/:id/publish`, `POST /jobs/:id/close`, `DELETE /jobs/:id`.
- Columns: title, status, applications, views if available, updated, actions.
- UX: bulk actions only if backend adds bulk endpoints; otherwise per-row actions.

### Create/Edit Job

- Fields: title, description, apply mode, apply URL, employment type, workplace type, location, skills, salary min/max/currency.
- Backend: `POST /jobs`, `PATCH /jobs/:id`.
- UX: draft save, publish action after validation; external URL required for `EXTERNAL` and recommended for `HYBRID`.

### Job Applications

- Pipeline view and table view for one job.
- Backend: `GET /jobs/:jobId/applications`.
- Columns/cards: applicant, status, submitted date, resume, notes count.
- Actions: open detail, status change, add note.
- Performance: cursor pagination per status tab if client-side grouping gets large.

### Application Review

- Detail workspace for employer.
- Content: applicant profile summary, application answers, cover letter, resume download, status history, internal notes.
- Backend: application detail, resume URL, status update, notes.
- UX: sticky status controls; note composer; audit-like timeline.

## Recruiting

### Recruiting Dashboard

- Company-scoped overview of saved candidates, talent pools, recent candidate activity.
- Backend: `GET /companies/:companyId/saved-candidates`, `GET /companies/:companyId/talent-pools`.
- UX: active company selector; empty state points to People Search.

### Saved Candidates

- Table/list: candidate, source, note snippet, saved by, saved date.
- Actions: save/unsave, add to pool, message, add note if using candidate notes in service.
- Backend: saved-candidate endpoints, `POST /conversations/recruiting`.
- UX: bulk add only after backend support; use per-candidate actions now.

### Talent Pools

- List and detail pages.
- List actions: create/edit/delete pool.
- Detail content: pool metadata, candidate list, add/remove candidate.
- Backend: talent-pool endpoints.
- UX: deleting pool requires confirmation; keep candidate removal reversible only until request completes.

### Candidate Profile For Recruiters

- Uses authenticated profile detail plus recruiting sidebar.
- Backend: `GET /profiles/:userId`, save candidate, add to pool, recruiting conversation.
- UX: show recruiting actions only when active company has permission.

## Messaging And Realtime

### Inbox

- Two-pane layout: conversation list and selected thread.
- Backend: `GET /conversations`, `GET /conversations/:id/messages`, `PATCH /conversations/:id/read`.
- Realtime: `/chat`, `conversation:join`, `message:new`, typing, read receipts.
- UX: cursor-load older messages, optimistic send, reconnect banner, unread count sync.

### Conversation Detail

- Header: participants, title, online/presence indicator if available.
- Body: message groups by day/sender, read receipts, attachments if backend later exposes them.
- Composer: text input, send button, typing events.
- Backend: `POST /conversations/:id/messages`; media attachments are not accepted by current DTO, so hide attachment send until backend adds it.

### New Conversation

- Participant picker limited to one user by current DTO.
- Backend: `POST /conversations`.
- UX: route to existing conversation if backend returns one.

### Recruiting Conversation

- Candidate-focused start conversation action.
- Backend: `POST /conversations/recruiting` with `candidateUserId`.
- UX: require active company context before action.

## Notifications

### Notification Center

- List notifications with unread/read tabs.
- Backend: `GET /notifications`, `GET /notifications/unread-count`, mark read/read all.
- Realtime: `/realtime` `notification:new`.
- UX: optimistic read state; action URL navigation marks read first.

### Notification Popover

- Compact latest unread notifications from cache.
- Actions: mark all read, view all.
- Backend: same notification endpoints.
- Performance: use websocket event to prepend, avoid polling except fallback interval when socket disconnected.

## Media Flow

### Media Upload Component

- Shared component used by avatar, resume, and generic attachments. Company/logo/post-specific upload purposes are not exposed yet; use only backend-accepted purposes until API expands.
- Steps:
  1. `POST /media/initiate`
  2. Upload file to presigned URL
  3. `POST /media/:id/confirm`
  4. Pass media asset ID to domain mutation
- Required UI: file picker/dropzone, progress, validation errors, remove/replace, retry.
- Constraints: purpose currently accepts `avatar`, `resume`, `attachment`; content type and size from backend env.

### Media Preview/Download

- Backend: `GET /media/:id`.
- UX: fetch URL lazily; expire-aware refetch on failed media load.

## Billing

### Plans

- Public plan comparison.
- Backend: `GET /billing/plans`, `GET /billing/plans/:planId`.
- UX: authenticated company owner can choose plan; anonymous choosing a plan starts auth/company flow.

### Company Subscription

- Current plan, status, period dates, cancel-at-period-end, change/cancel actions.
- Backend: `GET /companies/:companyId/subscription`, `POST /companies/:companyId/subscription`, `DELETE /companies/:companyId/subscription`.
- UX: company owner only for create/cancel; billing admin/admin can view.

### Invoices

- Invoice table and invoice detail.
- Backend: `GET /companies/:companyId/invoices`, `GET /companies/:companyId/invoices/:invoiceId`.
- Elements: invoice number, status, amount due/paid, period, due date, paid date, provider URL, line items.
- UX: provider URL opens in new tab when present.

### Admin Billing Plans

- Admin table of plans and edit/create form.
- Backend: `POST /admin/billing/plans`, `PATCH /admin/billing/plans/:planId`.
- Form fields: name, slug, description, features JSON/editor, monthly/yearly price, public flag.

## Search And Recommendations

### Search Results

- Tabs: All, People, Companies, Jobs, Posts.
- Backend: federated and type-specific search routes.
- Result elements by type:
  - People: display name, headline, location, connect/follow/message.
  - Companies: verified badge, industry, headquarters, follow.
  - Jobs: title, company, workplace, employment, save/apply.
  - Posts: author, snippet, reaction/comment counts.
- Performance: cache per query/scope; keep query in URL.

### Recommendations

- Dedicated page or dashboard modules for people, jobs, companies.
- Backend: `/recommendations/people`, `/recommendations/jobs`, `/recommendations/companies`.
- UX: dismiss/save/connect/apply actions should update lists locally even though feedback endpoints are not currently exposed.

## Moderation

### Moderation Queue

- Tabs by report status.
- Backend: `GET /moderation/reports?status=...`.
- Elements: target type, category, priority, reporter, assigned moderator, created time, status.
- Actions: claim, view target, apply action.

### Report Detail / Action Panel

- Content: report metadata, target preview, history/actions, action form.
- Backend: `PATCH /moderation/reports/:id/claim`, `POST /moderation/actions`.
- Action fields: action type, target entity, target ID, reason, duration hours.
- UX: destructive actions require confirmation and clear reason.

## Admin

### Admin Dashboard

- Cards linking to users, companies, jobs, moderation, analytics, outbox.
- Backend: admin list endpoints, analytics dashboard.
- UX: show permission-gated cards only.

### User Management

- Table with status/search filters.
- Backend: `GET /admin/users`, `PATCH /admin/users/:id/status`.
- Elements: email, display name, status, created date, status action with reason.

### Company Management

- Table with search and verification controls.
- Backend: `GET /admin/companies`, `PATCH /admin/companies/:id/verification`.
- Elements: company, verified status, industry, created date, notes field for verification action.

### Job Management

- Table filtered by company ID and cursor.
- Backend: `GET /admin/jobs`.
- Elements: title, company ID, status, created/updated date, link to job detail.

### Dead Letter Outbox

- Queue for failed outbox events.
- Backend: `GET /admin/outbox/dead-letter`, `POST /admin/outbox/dead-letter/:id/replay`.
- Elements: event type, payload preview, failure reason, failed date, replay action.
- UX: replay confirmation and post-replay refresh.

### Search Reindex

- Admin tool with entity type selector and run button.
- Backend: `POST /search/reindex?entityType=...`.
- UX: disable while request pending; show accepted state and link to admin logs if later available.

## Analytics

### Analytics Dashboard

- Admin-only overview.
- Backend: `GET /analytics/dashboard`.
- Elements: core counters, daily trends, top entities, recent events if returned.
- UX: date range controls only when backend supports them; otherwise use current backend aggregate.

### Entity Analytics

- Route by entity type and ID.
- Backend: `GET /analytics/entity/:type/:id`.
- Elements: views/impressions/clicks/events by entity.
- Used by: company admins, job managers, platform admins, if permissions allow.

### Analytics Event Tracking

- Client should record explicit product events for important views/clicks.
- Backend: `POST /analytics/events`.
- Events to send: profile view, company view, job view/apply click, post impression, search result click where product needs analytics.
- Performance: batch client-side only if backend adds batch endpoint; for now throttle/debounce low-value impressions.

## Error, Empty, And Access Pages

### Not Found

- For unknown routes and missing resources.
- Actions: go home, search, back.

### Unauthorized

- Shown when bearer token missing or expired and refresh fails.
- Actions: login, register.

### Forbidden

- Shown for missing company role/admin permission/email verification.
- Content: required access, active account/company switcher if relevant.

### Rate Limited

- Generic handler for 429 responses.
- UX: show retry after if provided by backend/proxy; otherwise exponential retry disabled by default for mutations.

### Offline / Reconnecting

- Shell banner for websocket/API connectivity.
- UX: queue no mutations by default; keep draft text locally for posts/messages/forms.

## Implementation Order

1. API client, auth refresh, response/error normalization, route guards, app shell.
2. Auth pages, profile onboarding, users/profiles.
3. Public feed/posts/comments/reactions and media upload.
4. Jobs search/detail/apply/my applications.
5. Companies and employer job management.
6. Messaging, notifications, realtime.
7. Network, search, recommendations.
8. Recruiting and billing.
9. Moderation, admin, analytics, outbox/reindex tools.

## Shared Components

- API error boundary with request ID reveal.
- Auth modal and verified-email gate.
- Cursor list with skeleton, empty, retry, end state.
- Media uploader and media preview.
- Profile/user card.
- Company card.
- Job card.
- Post card and composer.
- Comment thread.
- Reaction picker.
- Application status timeline.
- Company role gate.
- Admin permission gate.
- Search box with scope tabs.
- Notification bell/popover.
- Realtime connection status indicator.
