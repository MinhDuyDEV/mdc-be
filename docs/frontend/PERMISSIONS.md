# Permissions And Feature Gates

Source reviewed: route decorators, `AuthGuard`, `RolesGuard`, `CompanyRoleGuard`, `EmailVerifiedGuard`, company/job/billing/recruiting services.

## Global Auth

- All `/api/v1` routes require bearer auth unless marked `@Public()` or `@OptionalAuth()`.
- `@Public()` permits anonymous access.
- `@OptionalAuth()` permits anonymous access and attaches user context when token is valid.
- Admin/company guards still require authenticated user context.

## Public And Optional Routes

### Public

- `GET /`
- `GET /health/live`
- `GET /health/ready`
- Auth: register, login, refresh, verify email, resend verification, password reset request, password reset confirm
- Billing: `GET /billing/plans/:planId`, `POST /billing/webhooks/:provider`
- Companies: `GET /companies`, `GET /companies/:id`, `GET /companies/by-slug/:slug`
- Jobs: `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/external-apply-click`
- Feed: all `GET /feed/*`
- Posts: `GET /posts/:id`, `GET /posts/:id/comments`
- Profiles: `GET /profiles/search`

### Optional Auth

- `POST /analytics/events`
- `GET /billing/plans`
- `GET /media/:id`

## Email Verification Gates

Backend rejects these flows for users with `emailVerifiedAt = null`:

- Company creation and company invitation acceptance, enforced inside `CompaniesService`.
- `POST /jobs`
- `POST /jobs/:id/publish`
- `POST /posts`
- `PATCH /posts/:id`
- `DELETE /posts/:id`
- `POST /posts/:id/comments`
- `PATCH /posts/comments/:id`
- `DELETE /posts/comments/:id`
- `POST /posts/:id/reactions`
- `DELETE /posts/reactions/:id`
- `POST /posts/:id/save`
- `DELETE /posts/:id/save`
- `POST /posts/:id/hide`
- `DELETE /posts/:id/hide`
- `POST /conversations`
- `POST /conversations/recruiting`
- `POST /conversations/:id/messages`
- `POST /companies/:companyId/subscription`

Frontend should show a verified-email gate before these mutations.

## Company Roles

Company role hierarchy from `CompanyRoleGuard`:

| Role            | Level | Notes                                                      |
| --------------- | ----: | ---------------------------------------------------------- |
| `OWNER`         |     3 | Highest company role                                       |
| `ADMIN`         |     2 | Satisfies admin-level company guards                       |
| `BILLING_ADMIN` |     2 | Billing-focused role; only allowed where explicitly listed |
| `MEMBER`        |     1 | Read/member-level access                                   |

Guarded company endpoints:

| Endpoint                                        | Required company role                |
| ----------------------------------------------- | ------------------------------------ |
| `PATCH /companies/:id`                          | `OWNER` or `ADMIN`                   |
| `POST /companies/:id/members`                   | `OWNER` or `ADMIN`                   |
| `GET /companies/:id/members`                    | `OWNER`, `ADMIN`, or `MEMBER`        |
| `PATCH /companies/:id/members/:memberId`        | `OWNER` or `ADMIN`                   |
| `DELETE /companies/:id/members/:memberId`       | `OWNER` or `ADMIN`                   |
| `POST /companies/:id/members/invite`            | `OWNER` or `ADMIN`                   |
| `POST /companies/:id/recruiter-seats/allocate`  | `OWNER` or `ADMIN`                   |
| `DELETE /companies/:id/recruiter-seats/:seatId` | `OWNER` or `ADMIN`                   |
| `POST /companies/:companyId/subscription`       | `OWNER`                              |
| `GET /companies/:companyId/subscription`        | `OWNER`, `ADMIN`, or `BILLING_ADMIN` |
| `DELETE /companies/:companyId/subscription`     | `OWNER`                              |
| `GET /companies/:companyId/invoices`            | `OWNER`, `ADMIN`, or `BILLING_ADMIN` |
| `GET /companies/:companyId/invoices/:invoiceId` | `OWNER`, `ADMIN`, or `BILLING_ADMIN` |

Service-level company policies also protect jobs, applications, and recruiting operations by company membership/recruiter role even when no route-level `@CompanyRole` decorator appears.

## Recruiting Gates

Recruiting routes are under `/companies/:companyId`.

- User must satisfy recruiting service policy for that company.
- Recruiting service checks `recruiter_seats` entitlement before recruiter-only actions.
- Candidate messaging uses `POST /conversations/recruiting` with `candidateUserId`; current DTO does not accept `companyId` or initial message body.

Recruiting endpoints:

- `POST /companies/:companyId/saved-candidates`
- `DELETE /companies/:companyId/saved-candidates/:candidateUserId`
- `GET /companies/:companyId/saved-candidates`
- `POST /companies/:companyId/talent-pools`
- `GET /companies/:companyId/talent-pools`
- `PATCH /companies/:companyId/talent-pools/:poolId`
- `DELETE /companies/:companyId/talent-pools/:poolId`
- `POST /companies/:companyId/talent-pools/:poolId/candidates`
- `DELETE /companies/:companyId/talent-pools/:poolId/candidates/:candidateUserId`

## Admin Roles And Permissions

Admin role hierarchy:

| Role          | Level |
| ------------- | ----: |
| `SUPER_ADMIN` |     3 |
| `ADMIN`       |     2 |
| `MODERATOR`   |     1 |

`SUPER_ADMIN` bypasses specific permission checks after role check. Other admin roles need at least one required permission assigned.

| Endpoint                                    | Required role/permission                        |
| ------------------------------------------- | ----------------------------------------------- |
| `GET /admin/users`                          | role `admin`, `MANAGE_USERS`                    |
| `PATCH /admin/users/:id/status`             | role `admin`, `MANAGE_USERS`                    |
| `GET /admin/companies`                      | role `admin`, `MANAGE_COMPANIES`                |
| `PATCH /admin/companies/:id/verification`   | role `admin`, `MANAGE_COMPANIES`                |
| `GET /admin/jobs`                           | role `admin`, `MANAGE_JOBS`                     |
| `GET /admin/outbox/dead-letter`             | role `admin`, `MANAGE_ADMINS`                   |
| `POST /admin/outbox/dead-letter/:id/replay` | role `admin`, `MANAGE_ADMINS`                   |
| `GET /analytics/dashboard`                  | role `admin`, `VIEW_ANALYTICS`                  |
| `GET /analytics/entity/:type/:id`           | role `admin`, `VIEW_ANALYTICS`                  |
| `POST /search/reindex`                      | role `admin`, `MANAGE_JOBS`                     |
| `GET /moderation/reports`                   | role `admin` or `moderator`, `MODERATE_CONTENT` |
| `PATCH /moderation/reports/:id/claim`       | role `admin` or `moderator`, `MODERATE_CONTENT` |
| `POST /moderation/actions`                  | role `admin` or `moderator`, `MODERATE_CONTENT` |

## Frontend Route Guards

- Anonymous-only pages: login, register, password reset.
- Authenticated pages: profile edit, account settings, applications, saved jobs/posts, connections, messages, notifications.
- Verified-email mutation gates: jobs/posting/messaging/company creation/subscription.
- Company role gates: company edit, members, recruiter seats, billing, employer jobs/applications.
- Recruiting gates: saved candidates, talent pools, recruiting conversation.
- Admin gates: admin dashboard, user/company/job management, outbox replay, reindex, analytics.
- Moderator gates: moderation queue and actions.
