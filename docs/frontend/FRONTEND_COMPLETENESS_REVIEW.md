# Frontend Completeness Review

Status: the docs are sufficient for a frontend team to build against the current backend without inventing routes. They are not sufficient for a zero-guess, fully generated, 100% typed integration until the backend exposes a few missing contracts.

## What Is Complete Now

- Endpoint inventory by domain.
- Auth/refresh/cookie rules.
- Public, optional-auth, authenticated, company-role, admin, moderator, and email-verification gates.
- Realtime namespaces and event names.
- Media upload flow and current purpose limitations.
- Environment/settings needed by frontend deployment.
- Page-by-page product plan for a full professional networking/jobs app.
- Frontend implementation spec for API client, route guards, cache, realtime, media, form validation, UX states, and performance.
- Type file aligned with current DTO names for common request/response use.

## What Still Blocks 100% FE Adaptation

These gaps are backend/API contract issues, not frontend planning issues.

### P0: Machine-Readable API Contract

Problem: backend does not expose OpenAPI/Swagger and does not generate a frontend client.

Impact:

- FE still depends on docs and manual typing.
- Nested response shapes can drift.
- Error unions and pagination metadata are not enforceable at compile time.

Needed:

- Add `@nestjs/swagger`.
- Decorate DTOs/responses.
- Emit `openapi.json` in CI.
- Generate frontend client/types from `openapi.json`.
- Add contract tests that diff generated schema.

### P0: Session Bootstrap Endpoint

Problem: no single endpoint returns current user, profile completeness, companies/roles, admin permissions, notification count, feature flags.

Impact:

- FE must call multiple endpoints and still cannot know all route gates upfront.
- Company/admin navigation cannot be rendered confidently.
- First paint needs more round trips.

Recommended endpoint:

```http
GET /api/v1/session/bootstrap
```

Recommended response:

```ts
interface SessionBootstrap {
  user: User;
  profile: Profile | null;
  companies: Array<{
    id: string;
    name: string;
    slug: string;
    role: CompanyRole;
    verified: boolean;
  }>;
  admin: null | {
    role: AdminRole;
    permissions: AdminPermissionName[];
  };
  notificationUnreadCount: number;
  emailVerified: boolean;
}
```

### P0: Exact Response DTO Coverage

Problem: many services return Prisma-selected objects directly instead of explicit response DTOs.

Impact:

- FE cannot know nested fields with full certainty from DTO files alone.
- Docs can list intended shapes, but code generation cannot enforce all output shapes.

Needed:

- Response DTO for every controller method.
- Shared pagination response DTO.
- Explicit DTOs for feed, search result items, recommendations, admin list rows, moderation rows, bootstrap.

### P1: Company Membership Discovery

Problem: FE can list members for a known company, but no endpoint lists "my companies".

Impact:

- Company switcher and role-aware navigation need a bootstrap endpoint or separate current-user companies endpoint.

Recommended endpoint:

```http
GET /api/v1/users/me/companies
```

### P1: Admin Permission Discovery

Problem: admin guards can validate permissions, but FE has no endpoint to fetch current admin role/permissions.

Impact:

- Admin navigation can only be discovered through failed/successful route calls.

Recommended endpoint:

```http
GET /api/v1/admin/me
```

### P1: Saved Posts Listing

Problem: backend supports saving/unsaving posts but has no `GET /posts/saved`.

Impact:

- Full saved-content page cannot include saved posts.

Recommended endpoint:

```http
GET /api/v1/posts/saved?cursor=&limit=
```

### P1: Follow Graph Listing

Problem: backend supports follow/unfollow but not followers/following list pages.

Impact:

- Network UX can show connections and pending requests, but not full follower/following pages.

Recommended endpoints:

```http
GET /api/v1/users/:id/followers?cursor=&limit=
GET /api/v1/users/:id/following?cursor=&limit=
```

### P1: Recommendation Feedback

Problem: Prisma has recommendation feedback/dismissal models, but no endpoints expose dismiss/feedback actions.

Impact:

- FE can show recommendations but cannot persist "not interested" or feedback.

Recommended endpoints:

```http
POST /api/v1/recommendations/:type/:id/dismiss
POST /api/v1/recommendations/:type/:id/feedback
```

### P1: Messaging Attachments And Group Chat

Problem: schema supports attachments and group conversation type, but current DTOs support only one participant and message `content`.

Impact:

- FE must hide message attachments and group chat controls.

Needed:

- Extend `CreateConversationDto` for multiple participants when group chat is wanted.
- Extend `SendMessageDto` with media asset IDs when attachments are wanted.

### P1: Company Verification Request Flow

Problem: admin can verify companies, but company users cannot submit verification request documents through an endpoint.

Impact:

- FE can show verification status and admin verify action, but cannot build company-side "request verification" flow.

Recommended endpoint:

```http
POST /api/v1/companies/:id/verification-requests
```

### P2: Application Pipeline Metadata

Problem: status machine exists in backend, but FE has no endpoint exposing allowed transitions.

Impact:

- FE must hardcode application transitions or infer from errors.

Recommended endpoint:

```http
GET /api/v1/applications/:id/allowed-status-transitions
```

### P2: Analytics Query Controls

Problem: analytics endpoints expose dashboard/entity reads but no documented date range/filter DTO.

Impact:

- FE analytics page should avoid date filters until backend adds query params.

Recommended query params:

```http
GET /api/v1/analytics/dashboard?from=&to=&granularity=
GET /api/v1/analytics/entity/:type/:id?from=&to=&granularity=
```

### P2: Pagination Metadata Consistency

Problem: most lists use `nextCursor`/`hasMore`, while some admin services return `hasNextPage`/`endCursor`.

Impact:

- FE list component needs adapter logic per endpoint.

Needed:

- Standardize `meta: { nextCursor, hasMore }` across list endpoints or document exceptions in OpenAPI.

## FE Build Guidance Until Gaps Are Closed

- Build all supported modules from [PAGE_PLAN.md](./PAGE_PLAN.md).
- Hide or mark as future any UI requiring endpoints listed above.
- Do not implement group chat, message attachments, saved-post list, follower/following pages, recommendation feedback persistence, company verification request, or analytics date filters as production features until backend adds routes.
- Use server 403 as final permission authority.
- Use route-level lazy discovery for company/admin permissions until bootstrap endpoint exists.

## Recommended Backend Work To Reach 100%

1. Add OpenAPI generation and generated frontend client.
2. Add session bootstrap endpoint.
3. Add explicit response DTOs and pagination DTOs for all controllers.
4. Add company/admin self-discovery endpoints or include them in bootstrap.
5. Add saved posts and follow graph list endpoints.
6. Add recommendation feedback/dismiss endpoints.
7. Decide whether message attachments/group chat are in scope; expose DTOs if yes.
8. Add company verification request endpoint if company-side verification is a product feature.
9. Standardize pagination metadata.
10. Add contract/e2e fixtures for every page-critical endpoint.

## Review Verdict

Frontend can build a complete current-backend experience from these docs. A "100% adapt" experience with generated safety, no route guessing, complete role-aware navigation, and all polished UX affordances needs the backend additions above.
