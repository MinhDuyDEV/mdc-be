# MDC Backend API Documentation

> **Base URL:** `/api/v1`
> **Response Envelope:** `{ data: T, meta?: { ... } }` (trừ webhook và health check)
> **Auth:** `Bearer <accessToken>` trong header `Authorization` (trừ các endpoint `@Public()`)
> **Refresh Token:** HttpOnly cookie, path `/api/v1/auth`
> **Pagination:** Cursor-based — `{ cursor?: string, limit?: number }`

---

## Mục lục

1. [Authentication](#1-authentication)
2. [Users & Profiles](#2-users--profiles)
3. [Companies](#3-companies)
4. [Jobs](#4-jobs)
5. [Applications](#5-applications)
6. [Connections](#6-connections)
7. [Messaging](#7-messaging)
8. [Feed & Posts](#8-feed--posts)
9. [Notifications](#9-notifications)
10. [Devices](#10-devices)
11. [Media](#11-media)
12. [Search](#12-search)
13. [Recommendations](#13-recommendations)
14. [Recruiting](#14-recruiting)
15. [Billing](#15-billing)
16. [Admin](#16-admin)
17. [Moderation](#17-moderation)
18. [Analytics](#18-analytics)
19. [Experiments](#19-experiments)
20. [GDPR](#20-gdpr)
21. [Email Tracking](#21-email-tracking)
22. [Health & Metrics](#22-health--metrics)
23. [Real-time (WebSocket)](#23-real-time-websocket)

---

## 1. Authentication

### `POST /auth/register`
Tạo tài khoản mới. Rate limit: 3 request/phút.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "handle": "john_doe",
  "displayName": "John Doe"
}
```
`handle` và `displayName` là optional.

**Response `201`:** `{ data: { id, email, handle, displayName, createdAt } }`

---

### `POST /auth/login`
Đăng nhập, trả về accessToken + set refreshToken cookie. Rate limit: 5 request/phút.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "myPassword"
}
```

**Response `200`:**
```json
{
  "data": {
    "accessToken": "jwt...",
    "user": { "id": "uuid", "email": "user@example.com", "handle": "...", ... }
  }
}
```

**Cookie set:** `refreshToken` (httpOnly, secure, sameSite, path=/api/v1/auth)

---

### `POST /auth/refresh`
Refresh accessToken bằng refreshToken từ cookie. Rate limit: 10 request/phút.

**Yêu cầu:** Cookie `refreshToken`

**Response `200`:**
```json
{
  "data": {
    "accessToken": "new-jwt...",
    "refreshToken": "new-refresh..."
  }
}
```
Cookie `refreshToken` được set lại.

---

### `POST /auth/logout`
Thu hồi refreshToken. Yêu cầu `Authorization: Bearer <token>`.

**Response `200`:** `{ data: { message: "Logged out successfully" } }`
Cookie `refreshToken` bị xoá.

---

### `POST /auth/verify-email`
Xác thực email bằng token.

**Request body:**
```json
{ "token": "verification-token-from-email" }
```

**Response `200`:** `{ data: { message: "Email verified successfully" } }`

---

### `POST /auth/resend-verification`
Gửi lại email xác thực. Rate limit: 1 request/phút. Luôn trả về message giống nhau để chống email enumeration.

**Request body:**
```json
{ "email": "user@example.com" }
```

**Response `200`:** `{ data: { message: "If the email exists, a new verification email has been sent" } }`

---

### `POST /auth/password-reset/request`
Yêu cầu reset mật khẩu. Rate limit: 3 request/5 phút.

**Request body:**
```json
{ "email": "user@example.com" }
```

**Response `200`:** `{ data: { message: "..." } }`

---

### `POST /auth/password-reset/confirm`
Xác nhận reset mật khẩu. Rate limit: 3 request/5 phút.

**Request body:**
```json
{
  "token": "reset-token",
  "newPassword": "newPassword123"
}
```

**Response `200`:** `{ data: { message: "..." } }`

---

## 2. Users & Profiles

### `GET /users/me`
Lấy thông tin user hiện tại + roles, permissions, và company memberships. **Auth required.**

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "handle": "john_doe",
    "displayName": "John Doe",
    "emailVerifiedAt": "2024-01-01T00:00:00Z",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00Z",
    "isSuperAdmin": false,
    "isAdmin": true,
    "isModerator": true,
    "adminPermissions": ["MANAGE_USERS", "MANAGE_COMPANIES"],
    "companyMemberships": [
      {
        "companyId": "uuid",
        "companyName": "Tech Corp",
        "companySlug": "tech-corp",
        "role": "OWNER"
      }
    ],
    "recruiterSeats": [
      { "seatId": "uuid", "companyId": "uuid" }
    ]
  }
}
```

**Role flags:**
- `isSuperAdmin` — `true` khi user có role `SUPER_ADMIN`
- `isAdmin` — `true` khi user có role `ADMIN` hoặc `SUPER_ADMIN`
- `isModerator` — `true` khi user có role `MODERATOR`, `ADMIN`, hoặc `SUPER_ADMIN`

**Company memberships:** Mỗi entry gồm `companyId`, `companyName`, `companySlug`, `role` (`OWNER | ADMIN | MEMBER | BILLING_ADMIN`). Chỉ trả về membership có `status = 'active'`.

**Admin permissions:** Danh sách các permission như `MANAGE_USERS`, `MANAGE_COMPANIES`, `MANAGE_JOBS`, `MODERATE_CONTENT`, `VIEW_ANALYTICS`, `MANAGE_ADMINS`. Mảng rỗng nếu không phải admin.

**Recruiter seats:** `recruiterSeats[]` liệt kê các seat (`status = 'allocated'`) user đang nắm giữ — mỗi entry có `seatId` và `companyId`. Dùng để FE render employer UI cho `MEMBER` (role `MEMBER` một mình **không đủ** quyền employer; cần OWNER/ADMIN **hoặc** đang giữ recruiter seat của company đó). Xem §4 Jobs — quyền employer trên một job được derive từ: CompanyMember active role `OWNER`/`ADMIN` **hoặc** RecruiterSeat allocated của company sở hữu job.

---

### `PATCH /users/me`
Cập nhật thông tin user hiện tại. **Auth required.**

**Request body:** `UpdateProfileDto` — partial object với các field của profile.

---

### `DELETE /users/me`
Yêu cầu xoá tài khoản (GDPR). Trả về `202 Accepted`.

**Request body (optional):**
```json
{ "reason": "Optional reason" }
```

**Response `202`:**
```json
{
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "scheduledFor": "2024-02-01T00:00:00Z",
    "dueBy": "2024-02-15T00:00:00Z"
  }
}
```

---

### `GET /users/:id`
Lấy public profile của user khác.

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "handle": "jane_doe",
    "displayName": "Jane Doe",
    "profile": { ... }
  }
}
```

---

### `GET /profiles/me`
Lấy profile của user hiện tại. **Auth required.**

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "headline": "Software Engineer",
    "bio": "...",
    "avatarUrl": "...",
    "skills": [...],
    "experiences": [...],
    "educations": [...],
    "certifications": [...],
    "languages": [...]
  }
}
```

---

### `PATCH /profiles/me`
Cập nhật profile hiện tại. Rate limit: 10 request/phút. **Auth required.**

**Request body:** `UpdateProfileDto` (partial)
```json
{
  "headline": "Senior Engineer",
  "bio": "New bio",
  "skills": [{ "name": "TypeScript", "proficiency": "ADVANCED", "category": "LANGUAGE" }],
  "experiences": [...],
  "educations": [...],
  "certifications": [...],
  "languages": [...]
}
```

---

### `GET /profiles/search?q=keyword&limit=20&offset=0`
Tìm kiếm profiles. Public endpoint.

**Response `200`:**
```json
{
  "data": {
    "items": [...],
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

---

### `GET /profiles/:userId`
Xem public profile của user.

**Response `200`:** Profile object.

---

### `POST /profiles/:userId/skills/:skillId/endorse`
Endorse một kỹ năng. **Auth required.**

**Response `201`:** `{ data: { ... } }`

---

### `DELETE /profiles/:userId/skills/:skillId/endorse`
Gỡ endorse. **Auth required.**

**Response `200`:** `{ data: { ... } }`

---

## 3. Companies

### `POST /companies`
Tạo công ty mới. Idempotent. **Auth required.**

**Request body:**
```json
{
  "name": "Tech Corp",
  "industry": "TECHNOLOGY",
  "description": "...",
  "website": "https://techcorp.com",
  "employeeCount": "50-200",
  "foundedYear": 2020,
  "headquarters": "Hanoi, Vietnam"
}
```

**Response `201`:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Tech Corp",
    "slug": "tech-corp",
    "...": "..."
  }
}
```

---

### `GET /companies`
Danh sách công ty. Public. Query params: `cursor`, `limit`, `q`, `industry`.

---

### `GET /companies/:id`
Chi tiết công ty. Public.

---

### `GET /companies/by-slug/:slug`
Chi tiết công ty theo slug. Public.

---

### `PATCH /companies/:id`
Cập nhật công ty. Chỉ OWNER/ADMIN.

---

### `POST /companies/:id/follow`
Follow công ty. **Auth required.** Response `204 No Content`.

---

### `DELETE /companies/:id/follow`
Unfollow công ty. **Auth required.** Response `204 No Content`.

---

### Members

#### `POST /companies/:id/members`
Thêm member. Chỉ OWNER/ADMIN.

#### `GET /companies/:id/members`
Danh sách members. Yêu cầu OWNER/ADMIN/MEMBER.

#### `PATCH /companies/:id/members/:memberId`
Cập nhật role member. Chỉ OWNER/ADMIN.

#### `DELETE /companies/:id/members/:memberId`
Xoá member. Chỉ OWNER/ADMIN. Response `204`.

#### `POST /companies/:id/members/invite`
Mời member qua email. Chỉ OWNER/ADMIN.

#### `POST /companies/invitations/accept`
Chấp nhận lời mời bằng token.

---

### Recruiter seats

#### `POST /companies/:id/recruiter-seats/allocate`
Cấp recruiter seat cho user. Chỉ OWNER/ADMIN.

#### `DELETE /companies/:id/recruiter-seats/:seatId`
Thu hồi recruiter seat. Chỉ OWNER/ADMIN. Response `204`.

---

## 4. Jobs

### Job object
Shape trả về ở cả list lẫn detail (`JobResponseDto`):
```json
{
  "id": "uuid",
  "companyId": "uuid",
  "title": "Senior Engineer",
  "description": "...",
  "applyMode": "INTERNAL | EXTERNAL | HYBRID",
  "applyUrl": "https://..." ,          // null khi INTERNAL
  "status": "DRAFT | PUBLISHED | CLOSED | ARCHIVED | DELETED",
  "employmentType": "FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP | TEMPORARY",
  "workplaceType": "ONSITE | HYBRID | REMOTE",
  "location": "Hanoi",                  // nullable
  "salaryMin": 50000,                   // number | null (Decimal→number)
  "salaryMax": 80000,                   // number | null
  "salaryCurrency": "USD",              // nullable, ISO 4217 3 ký tự
  "requireResume": false,               // true → apply bắt buộc có resume
  "publishedAt": "2024-01-01T00:00:00Z", // nullable
  "closedAt": null,                     // nullable
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "skills": ["uuid1", "uuid2"],         // mảng skillId (KHÔNG phải object skill)
  "screeningQuestions": [               // xem §Screening questions bên dưới
    {
      "id": "uuid",
      "question": "How many years of Go?",
      "type": "NUMERIC",
      "required": true,
      "options": [],
      "position": 0
    }
  ],
  "isSaved": true,                      // boolean cho user đã login; null cho anon
  "isApplied": false                    // boolean cho user đã login; null cho anon
}
```
- `company`: chỉ trả `companyId` (KHÔNG có nested company object). FE fetch company riêng.
- `isSaved` / `isApplied`: `boolean` khi caller đã authenticate (FE dùng để disable nút Apply / toggle Save); `null` cho anonymous. Candidate chỉ thấy `PUBLISHED`.
- `viewCount` / `applyCount`: chưa expose.

### Screening questions
Nằm trong `screeningQuestions[]` của Job (list + detail). Mỗi question:
```json
{ "id": "uuid", "question": "text", "type": "TEXT | BOOLEAN | SINGLE_CHOICE | MULTI_CHOICE | NUMERIC", "required": true, "options": ["a","b"], "position": 0 }
```
- `options`: bắt buộc ≥ 2 giá trị distinct cho `SINGLE_CHOICE` / `MULTI_CHOICE`; phải rỗng/omit cho `TEXT` / `BOOLEAN` / `NUMERIC`.
- Tối đa 50 câu/job.
- Câu hỏi được define khi `POST /jobs` / `PATCH /jobs/:id` (field `screeningQuestions[]`). Khi update, gửi lại toàn bộ danh sách (replace strategy).

### `POST /jobs`
Tạo job mới. Yêu cầu email verified. **Auth required.** Caller phải là CompanyMember active `OWNER`/`ADMIN` **hoặc** đang giữ RecruiterSeat của `companyId`.

**Request body:**
```json
{
  "title": "Senior Engineer",
  "description": "Job description...",
  "companyId": "uuid",
  "applyMode": "INTERNAL | EXTERNAL | HYBRID",
  "applyUrl": "https://...",
  "employmentType": "FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP | TEMPORARY",
  "workplaceType": "ONSITE | HYBRID | REMOTE",
  "location": "Hanoi",
  "salaryMin": 50000,
  "salaryMax": 80000,
  "salaryCurrency": "USD",
  "skillIds": ["uuid1", "uuid2"],
  "requireResume": false,
  "screeningQuestions": [
    { "question": "How many years of Go?", "type": "NUMERIC", "required": true },
    { "question": "Work arrangement?", "type": "SINGLE_CHOICE", "required": false, "options": ["Remote", "Hybrid", "Onsite"], "position": 1 }
  ]
}
```
**applyMode rules:** `INTERNAL` → không được có `applyUrl`; `EXTERNAL`/`HYBRID` → bắt buộc `applyUrl`.

**Response `201`:** Job object.

---

### `GET /jobs`
Danh sách jobs. Public. Query params:
- `cursor`, `limit` — pagination
- `companyId` — filter theo company
- `status` — filter theo status (anonymous → forced PUBLISHED; non-PUBLISHED yêu cầu caller là OWNER/ADMIN/RecruiterSeat của `companyId`)
- `employmentType`, `workplaceType`, `location` (contains, case-insensitive), `skillId`
- `q` — full-text search (khi có `q`, các filter khác trừ `companyId`/`status` bị bỏ qua)

Response envelope: `{ data: JobResponseDto[], meta: { nextCursor, hasNextPage, limit } }`.

---

### `GET /jobs/saved`
Jobs đã lưu của user. **Auth required.** Cursor pagination. Mỗi item: `{ savedJobId, savedAt, job: JobResponseDto }` (`isSaved = true`).

---

### `GET /jobs/:id`
Chi tiết job. Public (anon chỉ thấy `PUBLISHED`; non-PUBLISHED yêu cầu CompanyMember active của company sở hữu job). Trả Job object với `isSaved`/`isApplied` cho caller đã login.

---

### `PATCH /jobs/:id`
Cập nhật job. **Auth required.** (quyền employer như `POST /jobs`). Tất cả field optional; `screeningQuestions` (nếu gửi) thay thế toàn bộ danh sách hiện có; `skillIds` (nếu gửi) thay thế toàn bộ skills. `companyId` không đổi được.

---

### `POST /jobs/:id/publish`
Publish job. Yêu cầu email verified. **Auth required.** (DRAFT → PUBLISHED; tiêu tốn 1 credit `job_posts`.)

### `POST /jobs/:id/close`
Đóng job. **Auth required.** (PUBLISHED → CLOSED.)

### `DELETE /jobs/:id`
Xoá job (soft delete). Response `204`. **Auth required.**

---

### Save/Unsave

#### `POST /jobs/:id/save`
Lưu job. **Auth required.** Response `201`. (Idempotent; chỉ lưu được job `PUBLISHED`.)

#### `DELETE /jobs/:id/save`
Bỏ lưu job. **Auth required.** Response `204`.

---

### External Apply Click

#### `POST /jobs/:id/external-apply-click`
Ghi nhận click apply ngoài. Public. Response `204`. Reject `400 INTERNAL_ONLY_NO_EXTERNAL_APPLY` nếu job `INTERNAL`. Không dedup — ping mỗi lần click. Áp dụng rate-limit global (xem §Rate limiting).

---

### Saved Searches

Saved search lưu bộ lọc (`query` — cùng shape với query params `GET /jobs`) + `frequency` + `alertEnabled`. Khi có job mới match, backend gửi **alert qua 3 kênh**: in-app Notification (`SavedSearchMatch`), realtime WebSocket (`notification:new`), mobile push, **và** email. Dedup qua `JobAlertDelivery`.

#### `POST /jobs/saved-searches`
**Auth required.**
```json
{ "name": "Go remote", "query": { "employmentType": "FULL_TIME", "workplaceType": "REMOTE", "skillId": "uuid" }, "frequency": "REALTIME | DAILY | WEEKLY", "alertEnabled": true }
```
- `frequency`: `REALTIME` (gửi ngay khi job publish match), `DAILY` (9AM UTC, gom 24h), `WEEKLY` (9AM UTC thứ 2, gom 7 ngày).
- `alertEnabled`: `false` → tạm dừng alert (chỉ lưu filter để re-run). Mặc định `true`.
- `name` phải unique per user.
- Matching theo: `companyId`, `employmentType`, `workplaceType`, `location` (contains), `skillId`, `salaryMin`/`salaryMax` (overlap range). `q` (full-text) bị bỏ qua trong matching.

#### `GET /jobs/saved-searches`
Danh sách saved searches. **Auth required.** Cursor pagination. Mỗi item gồm `{ id, userId, name, query, frequency, alertEnabled, createdAt, updatedAt }`.

#### `PATCH /jobs/saved-searches/:id`
Cập nhật saved search (owner-only). **Auth required.** Body: `{ name?, query?, frequency?, alertEnabled? }`.

#### `DELETE /jobs/saved-searches/:id`
Xoá saved search. Response `204`. **Auth required.**

---

## 5. Applications

### Application status (state machine)
Enum đầy đủ: `SUBMITTED | REVIEWED | INTERVIEWING | OFFER | ACCEPTED | REJECTED | WITHDRAWN`. Initial = `SUBMITTED`. Terminal = `ACCEPTED`, `REJECTED`, `WITHDRAWN`.

| Trạng thái | Cho phép chuyển tới |
|---|---|
| `SUBMITTED` | `REVIEWED`, `REJECTED`, `WITHDRAWN` |
| `REVIEWED` | `INTERVIEWING`, `REJECTED`, `WITHDRAWN` |
| `INTERVIEWING` | `OFFER`, `REJECTED`, `WITHDRAWN` |
| `OFFER` | `ACCEPTED`, `REJECTED`, `WITHDRAWN` |
| `ACCEPTED` / `REJECTED` / `WITHDRAWN` | (terminal) |

- Candidate chỉ được `WITHDRAW` (qua `POST /applications/:id/withdraw`).
- Employer (OWNER/ADMIN/RecruiterSeat của company sở hữu job) được mọi transition **trừ** `WITHDRAW`.
- Transition trái luật → `400 INVALID_STATUS_TRANSITION` (hoặc `400 APPLICATION_TERMINAL` khi từ terminal).

### `POST /jobs/:jobId/applications`
Nộp đơn ứng tuyển. **Auth + email verified required** (unverified → `403 EMAIL_NOT_VERIFIED`).

**Quyền:** candidate thường. Employer của company sở hữu job → `403 RECRUITER_CANNOT_APPLY_TO_OWN_COMPANY`. Job phải `PUBLISHED` và `applyMode !== EXTERNAL` (EXTERNAL → `400 EXTERNAL_ONLY_NO_INTERNAL_APPLICATION`).

**Request body** (tất cả field optional):
```json
{
  "coverLetter": "...",                                  // ≤ 20000 ký tự
  "screeningAnswers": [
    { "questionId": "uuid", "question": "optional", "answer": "..." }
  ],
  "resumeMediaAssetId": "uuid"                           // media asset purpose="resume", status="READY"
}
```
- `resumeMediaAssetId`: optional **trừ khi** job có `requireResume: true` → bắt buộc (`400 RESUME_REQUIRED`). Asset phải do caller sở hữu (`400 RESUME_NOT_FOUND_OR_FOREIGN`), `purpose="resume"` (`400 RESUME_WRONG_PURPOSE`), `status="READY"` (`400 RESUME_NOT_READY`).
- `screeningAnswers`: mỗi `questionId` phải khớp một `screeningQuestions[]` của job (`400 UNKNOWN_SCREENING_QUESTION`); câu `required` phải có answer (`400 SCREENING_ANSWER_REQUIRED`); answer phải đúng kiểu theo `type`:
  - `TEXT` → chuỗi non-empty; `BOOLEAN` → `"true"`/`"false"`; `SINGLE_CHOICE` → một trong `options`; `MULTI_CHOICE` → các giá trị trong `options` cách nhau bởi dấu phẩy; `NUMERIC` → số hợp lệ.
  - `question` trên wire là **optional** — backend luôn lưu canonical question text lấy từ định nghĩa câu hỏi (chỉ cần `questionId`).
- **Duplicate apply:** không reject 409 — backend trả lại application đang active (idempotent). "Active" = status không thuộc `{WITHDRAWN, REJECTED}`. Sau withdraw/reject có apply lại (tạo record mới).

**Response `201`:** Application object (audience `candidate` — `notes` bị strip).

---

### `PATCH /applications/:id`
Sửa đơn sau submit (candidate-only, chỉ khi chưa terminal). **Auth required.**

**Request body:**
```json
{ "coverLetter": "...", "resumeMediaAssetId": "uuid" }
```
- Cả hai optional. `coverLetter` thay thế text. `resumeMediaAssetId` (nếu gửi) swap resume sang asset mới (cùng validate ownership/purpose/READY như apply) và thay thế attachment `resume`. Để bỏ resume hẳn → withdraw + apply lại.
- Employer gọi → `403 INSUFFICIENT_ACTOR_ROLE`. Trạng thái terminal → `400 APPLICATION_TERMINAL`.

**Response `200`:** Application object (audience `candidate`).

---

### `GET /jobs/:jobId/applications`
Danh sách ứng viên cho job (employer view). **Auth required.** Caller phải là employer của job (`403 INSUFFICIENT_COMPANY_ROLE`). Cursor pagination. Trả Application object audience `employer` (bao gồm `notes`).

---

### `GET /applications/me`
Danh sách đơn ứng tuyển của user. **Auth required.** Cursor pagination.

---

### `GET /applications/:id`
Chi tiết đơn ứng tuyển. **Auth required.** Candidate (owner) **hoặc** employer của job's company mới xem được (người ngoài → `404 APPLICATION_NOT_FOUND`, che existence). Audience `employer` thấy `notes`, audience `candidate` không.

---

### `PATCH /applications/:id/status`
Cập nhật trạng thái đơn (employer). **Auth required.**

**Request body:**
```json
{
  "newStatus": "REVIEWED | INTERVIEWING | OFFER | ACCEPTED | REJECTED",
  "reason": "Optional reason"
}
```
(`WITHDRAW` chỉ qua endpoint withdraw riêng — candidate-only.)

---

### `POST /applications/:id/withdraw`
Rút đơn (candidate-only, từ trạng thái non-terminal). **Auth required.** Employer gọi → `403 INSUFFICIENT_ACTOR_ROLE`; terminal → `400 APPLICATION_TERMINAL`. Sau withdraw có apply lại.

---

### Notes (employer-only)

#### `POST /applications/:id/notes`
Thêm note. **Auth required.** Employer-only — candidate → `403 NOTES_EMPLOYER_ONLY`. Body: `{ "content": "..." }` (1–10000 ký tự). Response `201`.

#### `GET /applications/:id/notes`
Danh sách notes. **Auth required.** Employer-only (`403 NOTES_EMPLOYER_ONLY`). Notes là private — candidate không thấy (cũng bị strip khỏi Application response khi audience `candidate`).

---

### Resume URL

#### `GET /applications/:id/resume-url`
Lấy download URL cho resume. **Auth required.** Candidate (owner) **hoặc** employer của job's company (mỗi request ghi audit log `application.resume.access`). Không có resume → `404 RESUME_NOT_ATTACHED`.

**Response `200`:**
```json
{
  "data": {
    "applicationId": "uuid",
    "mediaAssetId": "uuid",
    "mediaId": "uuid",
    "downloadUrl": "presigned-s3-url",
    "expiresIn": 300,
    "filename": "resume.pdf",
    "contentType": "application/pdf"
  }
}
```
TTL presigned URL = **300 giây** (hardcoded). FE refresh khi hết hạn.

---

## 6. Connections

### `POST /connections`
Gửi lời mời kết nối. **Auth required.**

**Request body:**
```json
{ "toUserId": "uuid" }
```

**Response `201`:** Connection object.

---

### `GET /connections`
Danh sách kết nối đã accept. Cursor pagination. **Auth required.**

---

### `GET /connections/pending`
Danh sách lời mời đang chờ. Cursor pagination. **Auth required.**

---

### `GET /connections/mutual/:userId`
Danh sách mutual connections với user khác. **Auth required.**

Query params: `cursor`, `limit`

---

### `PATCH /connections/:id/accept`
Chấp nhận lời mời kết nối. **Auth required.**

---

### `PATCH /connections/:id/decline`
Từ chối lời mời kết nối. **Auth required.**

---

### `DELETE /connections/:id`
Xoá kết nối. Response `204`. **Auth required.**

---

### Follow/Block (nằm ở `users` controller riêng)

#### `POST /users/:id/follow`
Follow user. Response `201`. **Auth required.**

#### `DELETE /users/:id/follow`
Unfollow user. Response `204`. **Auth required.**

#### `POST /users/:id/block`
Block user. Response `201`. **Auth required.**

#### `DELETE /users/:id/block`
Unblock user. Response `204`. **Auth required.**

---

## 7. Messaging

### `POST /conversations`
Tạo cuộc trò chuyện (1-1). Yêu cầu email verified. **Auth required.**

**Request body:**
```json
{ "participantIds": ["uuid"] }
```

---

### `POST /conversations/recruiting`
Tạo cuộc trò chuyện recruiting với candidate. Yêu cầu email verified. **Auth required.**

**Request body:**
```json
{ "candidateUserId": "uuid" }
```

---

### `GET /conversations`
Danh sách conversations. Cursor pagination. **Auth required.**

---

### `GET /conversations/:id`
Chi tiết conversation. **Auth required.**

---

### `POST /conversations/:id/messages`
Gửi tin nhắn. Yêu cầu email verified. Rate limit: 30/phút. **Auth required.**

**Request body:**
```json
{
  "content": "Message content (max 10k chars)",
  "attachmentIds": ["uuid1", "uuid2"]
}
```
`attachmentIds` là optional.

**Response `201`:** Message object.

---

### `GET /conversations/:id/messages`
Danh sách tin nhắn. Cursor pagination. **Auth required.**

---

### `PATCH /conversations/:id/read`
Đánh dấu đã đọc tất cả tin trong conversation. **Auth required.**

---

### Group Chat

#### `POST /conversations/group`
Tạo group conversation (tối thiểu 2 participant, tối đa 50). Yêu cầu email verified. **Auth required.**

**Request body:**
```json
{
  "title": "Group Name",
  "participantIds": ["uuid1", "uuid2"]
}
```

#### `PATCH /conversations/:id`
Cập nhật group conversation (tên, ảnh). **Auth required.**

#### `POST /conversations/:id/participants`
Thêm participant vào group. **Auth required.**

#### `DELETE /conversations/:id/participants/:userId`
Xoá participant khỏi group. **Auth required.**

---

### Message Edit & Delete

#### `PATCH /conversations/:id/messages/:messageId`
Sửa tin nhắn. **Auth required.**

#### `DELETE /conversations/:id/messages/:messageId`
Xoá tin nhắn (soft delete). **Auth required.**

---

### Message Search

#### `GET /conversations/messages/search?q=keyword&conversationId=uuid`
Tìm kiếm tin nhắn. Cursor pagination. **Auth required.**

Query params: `q` (max 500 chars), `conversationId` (optional filter)

---

## 8. Feed & Posts

### Feed

#### `GET /feed/home`
Home feed. Public (có tuỳ chọn auth). Cursor pagination.

Query params: `cursor`, `limit`

#### `GET /feed/profile/:userId`
Profile feed của user. Public. Cursor pagination.

#### `GET /feed/company/:companyId`
Company feed. Public. Cursor pagination.

#### `GET /feed/hashtag/:tag`
Hashtag feed. Public. Cursor pagination.

#### `GET /feed/trending?limit=10`
Trending hashtags. Public.

---

### Posts

#### `POST /posts`
Tạo bài viết. Yêu cầu email verified. Rate limit: 5/phút. **Auth required.**

**Request body:**
```json
{
  "content": "Post content",
  "visibility": "PUBLIC | CONNECTIONS | PRIVATE",
  "mediaAssetIds": ["uuid1"]
}
```

---

#### `GET /posts/:id`
Chi tiết bài viết. Public.

#### `PATCH /posts/:id`
Cập nhật bài viết. Yêu cầu email verified. **Auth required.**

#### `DELETE /posts/:id`
Xoá bài viết. Response `204`. Yêu cầu email verified. **Auth required.**

---

### Share / Repost

#### `POST /posts/:id/share`
Share/repost. Yêu cầu email verified. Rate limit: 5/phút. **Auth required.**

**Request body:**
```json
{ "content": "Optional share caption" }
```

---

### Comments

#### `GET /posts/:id/comments`
Danh sách comments. Public. Cursor pagination.

#### `POST /posts/:id/comments`
Tạo comment. Yêu cầu email verified. Rate limit: 10/phút. **Auth required.**

#### `PATCH /posts/comments/:id`
Sửa comment. Yêu cầu email verified. **Auth required.**

#### `DELETE /posts/comments/:id`
Xoá comment. Response `204`. Yêu cầu email verified. **Auth required.**

---

### Reactions

#### `POST /posts/:id/reactions`
Thêm reaction. Yêu cầu email verified. Rate limit: 30/phút. **Auth required.**

**Request body:**
```json
{ "type": "LIKE | CELEBRATE | SUPPORT | LOVE | INSIGHTFUL | CURIOUS" }
```

#### `DELETE /posts/reactions/:id`
Gỡ reaction. Response `204`. Yêu cầu email verified. **Auth required.**

---

### Save/Hide Posts

#### `POST /posts/:id/save`
Lưu bài viết. Response `201`. Yêu cầu email verified. **Auth required.**

#### `DELETE /posts/:id/save`
Bỏ lưu bài viết. Response `204`. Yêu cầu email verified. **Auth required.**

#### `POST /posts/:id/hide`
Ẩn bài viết. Response `201`. Yêu cầu email verified. **Auth required.**

#### `DELETE /posts/:id/hide`
Bỏ ẩn bài viết. Response `204`. Yêu cầu email verified. **Auth required.**

---

## 9. Notifications

### `GET /notifications?cursor=...&limit=20`
Danh sách notifications. Cursor pagination (newest first). **Auth required.**

**Response `200`:** `{ data: [...], meta: { nextCursor, hasNextPage, limit } }`

---

### `GET /notifications/unread-count`
Số notification chưa đọc. **Auth required.**

**Response `200`:** `{ data: { count: 5 } }`

---

### `PATCH /notifications/:id/read`
Đánh dấu một notification đã đọc. **Auth required.**

---

### `POST /notifications/read-all`
Đánh dấu tất cả đã đọc. **Auth required.**

---

### Notification Preferences

#### `GET /notifications/preferences`
Lấy preferences. **Auth required.**

#### `PUT /notifications/preferences`
Cập nhật preferences. **Auth required.**

---

## 10. Devices

### `POST /devices`
Đăng ký device cho push notification. **Auth required.**

**Request body:**
```json
{
  "deviceType": "ios | android | web",
  "deviceToken": "push-token-string",
  "deviceName": "iPhone 15"
}
```

### `GET /devices`
Danh sách devices. **Auth required.**

### `DELETE /devices/:id`
Xoá device. **Auth required.**

---

## 11. Media

Upload flow 4 bước: `POST /media/initiate` → PUT lên presigned S3 URL → `POST /media/:id/confirm` → (dùng `mediaId` ở apply/attach). Asset mồ côi (PENDING >1h) bị cron soft-delete (`status=DELETED`, không xóa object S3). Khuyến nghị FE tự `DELETE /media/:id` nếu apply fail sau khi confirm.

### `POST /media/initiate`
Khởi tạo upload file (nhận presigned URL). **Auth required.**

**Request body:**
```json
{
  "purpose": "avatar | resume | attachment",
  "filename": "photo.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 1024000
}
```
- `purpose="resume"`: MIME accept mặc định `image/jpeg, image/png, image/gif, image/webp, application/pdf` (override qua env `MEDIA_ALLOWED_CONTENT_TYPES`; **DOC/DOCX mặc định KHÔNG chấp nhận** — cần backend set env nếu muốn). Max size mặc định **20 MB** (`MEDIA_RESUME_MAX_SIZE_BYTES`).
- Validate ở initiate (content-type whitelist + size), lại ở S3 presigned (content-type/content-length), và lại ở `confirm`.

**Response `200`:**
```json
{
  "data": {
    "mediaId": "uuid",
    "uploadUrl": "presigned-s3-url",
    "expiresIn": 300
  }
}
```
(Presigned upload URL TTL = 300 giây.)

---

### `POST /media/:id/confirm`
Xác nhận upload hoàn tất. **Auth required.** (Owner-only; asset phải đang `PENDING`.) Re-verify content-type khớp S3 + size ≤ max. Nếu `virusScanEnabled` → scan; infected → `400`.

**Response `200`:** full `MediaAsset` record (sau khi flip `status: READY`):
```json
{
  "data": {
    "id": "uuid",
    "ownerId": "uuid",
    "purpose": "resume",
    "filename": "resume.pdf",
    "s3Key": "resume/...",
    "s3Bucket": "...",
    "contentType": "application/pdf",
    "sizeBytes": 1024000,
    "status": "READY",
    "visibility": "PRIVATE",
    "etag": "...",
    "scanStatus": "PENDING",
    "scanResult": null,
    "scannedAt": null,
    "thumbS3Key": null,
    "thumbGeneratedAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```
**Lưu ý:** confirm **không** trả download URL. Để lấy URL → `GET /media/:id`.

---

### `GET /media/:id`
Lấy download URL. Optional auth (PUBLIC asset xem được anon; PRIVATE cần owner hoặc connection tùy `visibility`).

**Response `200`:**
```json
{
  "data": {
    "mediaId": "uuid",
    "downloadUrl": "presigned-download-url",
    "expiresIn": 300,
    "filename": "resume.pdf",
    "contentType": "application/pdf"
  }
}
```
(TTL = 300 giây. Asset `PENDING`/`DELETED`/`QUARANTINED` → `404`.)

---

### `DELETE /media/:id`
Xoá media asset (soft delete, `status=DELETED`; **không** xóa object S3). **Auth required.** (Owner-only.) Response `200`: `MediaAsset` record đã soft-delete.

---

## 12. Search

### `GET /search?q=keyword&type=jobs,profiles&limit=20`
Unified search. **Auth required.**

Query params:
- `q` — search query (max 500 chars)
- `type` — comma-separated: `profiles`, `companies`, `jobs`, `posts`
- `limit` — max 100

---

### `GET /search/users?q=...`
Search profiles only.

### `GET /search/companies?q=...`
Search companies only.

### `GET /search/jobs?q=...`
Search jobs only.

### `GET /search/posts?q=...`
Search posts only.

---

### `GET /search/suggest?q=sen&limit=5`
Autocomplete suggestions. Public. Rate limit: 60/phút.

Query params: `q`, `type` (comma-separated entity types), `limit`

---

### `POST /search/reindex?entityType=jobs`
Admin: trigger reindex. Yêu cầu role admin + permission MANAGE_JOBS. Response `202`.

---

## 13. Recommendations

Tất cả endpoints đều yêu cầu auth. Rate limit: 30/phút.

### `GET /recommendations/people?cursor=...&limit=...`
Gợi ý kết nối.

### `GET /recommendations/jobs?cursor=...&limit=...`
Gợi ý job.

### `GET /recommendations/companies?cursor=...&limit=...`
Gợi ý company.

---

### `POST /recommendations/feedback`
Gửi feedback về recommendation.

**Request body:**
```json
{
  "entityType": "job | person | company",
  "entityId": "uuid",
  "relevanceScore": 5,
  "reason": "optional"
}
```

---

### `POST /recommendations/dismiss`
Bỏ qua recommendation.

**Request body:**
```json
{
  "entityType": "job | person | company",
  "entityId": "uuid"
}
```

---

## 14. Recruiting

Tất cả endpoints đều dưới `companies/:companyId`. Yêu cầu auth.

### Saved Candidates

#### `POST /companies/:companyId/saved-candidates`
Lưu candidate. Response `201`.

#### `DELETE /companies/:companyId/saved-candidates/:candidateUserId`
Bỏ lưu candidate. Response `204`.

#### `GET /companies/:companyId/saved-candidates`
Danh sách saved candidates. Cursor pagination.

---

### Talent Pools

#### `POST /companies/:companyId/talent-pools`
Tạo talent pool. Response `201`.

#### `GET /companies/:companyId/talent-pools`
Danh sách talent pools.

#### `PATCH /companies/:companyId/talent-pools/:poolId`
Cập nhật talent pool.

#### `DELETE /companies/:companyId/talent-pools/:poolId`
Xoá talent pool. Response `204`.

#### `POST /companies/:companyId/talent-pools/:poolId/candidates`
Thêm candidate vào pool. Response `201`.

#### `DELETE /companies/:companyId/talent-pools/:poolId/candidates/:candidateUserId`
Xoá candidate khỏi pool. Response `204`.

---

### Interviews

#### `POST /companies/:companyId/interviews`
Tạo lịch phỏng vấn. Response `201`.

#### `GET /companies/:companyId/interviews`
Danh sách phỏng vấn. Cursor pagination. Filter: `applicationId`.

#### `PATCH /companies/:companyId/interviews/:id`
Cập nhật phỏng vấn.

#### `POST /companies/:companyId/interviews/:id/interviewers`
Thêm interviewer. Response `201`.

---

### Scorecards

#### `POST /companies/:companyId/scorecards`
Submit scorecard. Response `201`.

#### `GET /companies/:companyId/scorecards`
Danh sách scorecards. Cursor pagination. Filter: `interviewId`, `applicationId`.

---

### Offers

#### `POST /companies/:companyId/offers`
Tạo offer. Response `201`.

#### `POST /companies/:companyId/offers/:id/send`
Gửi offer cho candidate. Response `201`.

#### `POST /offers/:id/respond`
Candidate phản hồi offer. **Auth required (candidate).** Response `201`.

**Request body:**
```json
{ "accepted": true }
```

---

## 15. Billing

### Plans

#### `GET /billing/plans`
Danh sách plans. Optional auth (admin thấy inactive plans).

#### `GET /billing/plans/:planId`
Chi tiết plan. Public.

#### `POST /admin/billing/plans` — Admin only. Tạo plan.
#### `PATCH /admin/billing/plans/:planId` — Admin only. Cập nhật plan.

---

### Subscriptions

#### `POST /companies/:companyId/subscription`
Tạo subscription. Chỉ OWNER, email verified.

#### `GET /companies/:companyId/subscription`
Chi tiết subscription. Yêu cầu OWNER/ADMIN/BILLING_ADMIN.

#### `DELETE /companies/:companyId/subscription`
Cancel subscription. Chỉ OWNER. Query: `atPeriodEnd=true` (default).

#### `POST /companies/:companyId/subscription/change-plan`
Đổi plan. Chỉ OWNER, email verified.

**Request body:**
```json
{
  "planId": "uuid",
  "atPeriodEnd": false,
  "prorationBehavior": "always_invoice | create_prorations | none"
}
```

---

### Invoices

#### `GET /companies/:companyId/invoices?cursor=...&limit=...`
Danh sách invoices. Yêu cầu OWNER/ADMIN/BILLING_ADMIN.

#### `GET /companies/:companyId/invoices/:invoiceId`
Chi tiết invoice.

---

### Payment Methods

Base path: `/companies/:companyId/payment-methods`

#### `POST .../setup-intent`
Tạo Stripe SetupIntent. Trả về client secret.

#### `POST ...`
Attach payment method từ provider.

**Request body:**
```json
{ "providerMethodId": "pm_..." }
```

#### `GET ...`
Danh sách payment methods.

#### `PATCH .../default`
Set payment method mặc định.

#### `DELETE ...`
Xoá payment method.

---

### Webhooks

#### `POST /billing/webhooks/:provider`
Webhook từ Stripe. Public, verify signature. `:provider` = `stripe`.

---

## 16. Admin

Tất cả endpoints require `AuthGuard` + `RolesGuard` + role `admin`.

### Users

#### `GET /admin/users?status=ACTIVE&q=...&cursor=...&limit=...`
Danh sách users. Permission: `MANAGE_USERS`.

#### `PATCH /admin/users/:id/status`
Cập nhật user status. Permission: `MANAGE_USERS`.

**Request body:**
```json
{ "status": "ACTIVE | DISABLED | SUSPENDED" }
```

---

### Companies

#### `GET /admin/companies?query...`
Danh sách companies. Permission: `MANAGE_COMPANIES`.

#### `PATCH /admin/companies/:id/verification`
Verify company. Permission: `MANAGE_COMPANIES`.

---

### Jobs

#### `GET /admin/jobs?query...`
Danh sách jobs. Permission: `MANAGE_JOBS`.

---

### Outbox Dead Letters

#### `GET /admin/outbox/dead-letter`
Danh sách dead letters. Permission: `MANAGE_ADMINS`.

#### `POST /admin/outbox/dead-letter/:id/replay`
Replay dead letter. Permission: `MANAGE_ADMINS`.

---

### Audit Logs

#### `GET /admin/audit-logs?query...`
Danh sách audit logs. Permission: `MANAGE_USERS`.

#### `GET /admin/audit-logs/export/csv?query...`
Export CSV. Rate limit: 5/giờ.

#### `GET /admin/audit-logs/export/json?query...`
Export JSON.

#### `GET /admin/audit-logs/export/ndjson?query...`
Export NDJSON.

#### `GET /admin/audit-logs/search?metadataKey=...&metadataValue=...`
Search audit logs by metadata.

---

### Admin Management (super_admin only)

#### `POST /admin/admins`
Tạo admin mới.

#### `DELETE /admin/admins/:id`
Xoá admin.

#### `PATCH /admin/admins/:id/permissions`
Cập nhật permissions.

#### `GET /admin/admins`
Danh sách admins.

---

## 17. Moderation

### `POST /moderation/reports`
Tạo report. **Auth required.** Rate limit: 5/10 phút.

**Request body:**
```json
{
  "entityType": "POST | COMMENT | MESSAGE | PROFILE | COMPANY | JOB",
  "entityId": "uuid",
  "category": "SPAM | HARASSMENT | HATE_SPEECH | ...",
  "description": "Optional description"
}
```

---

### `GET /moderation/reports?status=PENDING`
Danh sách reports. Yêu cầu admin/moderator + `MODERATE_CONTENT`.

### `PATCH /moderation/reports/:id/claim`
Claim report. Yêu cầu admin/moderator + `MODERATE_CONTENT`.

### `POST /moderation/actions`
Apply moderation action. Yêu cầu admin/moderator + `MODERATE_CONTENT`.

**Request body:**
```json
{
  "reportId": "uuid",
  "actionType": "WARN | REMOVE_CONTENT | SUSPEND_USER | BAN_USER | DISMISS",
  "reason": "..."
}
```

---

## 18. Analytics

### `POST /analytics/events`
Ghi nhận event. **Auth required.** Rate limit: 60/phút.

**Request body:**
```json
{
  "eventType": "PAGE_VIEW | PROFILE_VIEW | JOB_VIEW | ...",
  "entityType": "profile | job | company | post",
  "entityId": "uuid",
  "metadata": {}
}
```

---

### `GET /analytics/dashboard`
Dashboard metrics (admin + `VIEW_ANALYTICS`).

### `GET /analytics/recruiting`
Recruiting metrics (admin + `VIEW_ANALYTICS`).

### `GET /analytics/entity/:type/:id`
Entity analytics (admin + `VIEW_ANALYTICS`). Type enum: như `AnalyticsEventType`.

---

## 19. Experiments

### `POST /experiments/track`
Ghi nhận experiment impression. **Auth required.**

**Request body:**
```json
{
  "experimentId": "string",
  "variant": "control | variant_a | variant_b"
}
```

---

## 20. GDPR

Tất cả endpoints yêu cầu auth.

### `POST /gdpr/export`
Yêu cầu export dữ liệu. Response `202`.

**Response:**
```json
{
  "data": {
    "exportId": "uuid",
    "status": "PENDING"
  }
}
```

### `GET /gdpr/requests/:id`
Trạng thái deletion request.

### `POST /gdpr/delete`
Yêu cầu xoá tài khoản. Response `202`.

**Request body:**
```json
{ "reason": "Optional reason" }
```

### `POST /gdpr/cancel/:requestId`
Huỷ yêu cầu xoá.

---

## 21. Email Tracking

Tất cả đều là public endpoints (no auth).

### `GET /email/track/open/:emailId`
Open tracking — trả về 1×1 transparent GIF. Ghi nhận open event.

### `GET /email/track/click/:emailId?redirect=<encodedUrl>`
Click tracking — ghi nhận click + 302 redirect. Chỉ cho phép http(s) URLs.

### `GET /email/unsubscribe/:token`
One-click unsubscribe. Token HMAC-signed. Rate limit: 60/phút.
Query: `reason` (optional).

---

## 22. Health & Metrics

### Health

#### `GET /health/live`
Liveness check. Public. Không wrap trong response envelope.

#### `GET /health/ready`
Readiness check (DB, Redis, ...). Public. Không wrap trong response envelope.
Trả về `503` nếu không ready.

### Metrics

#### `GET /metrics`
Prometheus metrics. Public. Content-Type: `text/plain; version=0.0.4`.

---

## 23. Real-time (WebSocket)

### Namespace: `/realtime`
Kết nối WebSocket với namespace `realtime`. Auth bằng JWT token trong query param `token`.

**Kết nối:**
```javascript
const socket = io('wss://domain.com/realtime', {
  auth: { token: 'accessToken' }
});
```

**Server → Client events:**

| Event | Payload | Mô tả |
|---|---|---|
| `notification:new` | `{ id, type, title, body, actionUrl, createdAt }` | Notification realtime |
| `connect` | — | Kết nối thành công |
| `disconnect` | — | Mất kết nối |

---

### Namespace: `/chat`
Kết nối WebSocket với namespace `chat`. Auth bằng JWT token.

**Client → Server events (cần auth):**

| Event | Payload | Mô tả |
|---|---|---|
| `conversation:join` | `{ conversationId }` | Join room của conversation để nhận message realtime |
| `typing:started` | `{ conversationId }` | Báo hiệu đang gõ |
| `typing:stopped` | `{ conversationId }` | Báo hiệu ngừng gõ |
| `message:read` | `{ messageId, conversationId }` | Báo hiệu đã đọc tin nhắn |

**Server → Client events:**

| Event | Payload | Mô tả |
|---|---|---|
| `message:new` | `{ id, conversationId, senderId, content, createdAt }` | Tin nhắn mới |
| `message:edited` | `{ messageId, conversationId, editorId }` | Tin nhắn đã sửa |
| `message:deleted` | `{ messageId, conversationId, deleterId }` | Tin nhắn đã xoá |
| `typing:started` | `{ conversationId, userId }` | User đang gõ |
| `typing:stopped` | `{ conversationId, userId }` | User ngừng gõ |
| `message:read` | `{ messageId, conversationId, userId, readAt }` | User đã đọc tin nhắn |

---

## Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client   │         │  API     │         │  Storage  │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                     │                     │
     │  POST /auth/login   │                     │
     │  {email, password}  │                     │
     ├────────────────────>│                     │
     │                     │  Verify credentials │
     │                     ├────────────────────>│
     │                     │<────────────────────┤
     │  Set-Cookie:        │                     │
     │  refreshToken       │                     │
     │<────────────────────┤                     │
     │  {accessToken, user}│                     │
     │                     │                     │
     │  GET /users/me      │                     │
     │  Bearer accessToken │                     │
     ├────────────────────>│                     │
     │                     │  Verify JWT         │
     │                     │  (middleware)       │
     │<────────────────────┤                     │
     │  {data: { ... }}    │                     │
     │                     │                     │
     │  POST /auth/refresh │                     │
     │  Cookie: refreshToken│                     │
     ├────────────────────>│                     │
     │                     │  Rotate refreshToken│
     │  Set-Cookie: new    │                     │
     │<────────────────────┤                     │
     │  {newAccessToken}   │                     │
```

### Token Lifecycle

1. **Access Token (JWT):** short-lived (~15 phút), gửi trong `Authorization: Bearer <token>` header
2. **Refresh Token:** long-lived (~7 ngày), httpOnly cookie, tự động rotate mỗi lần dùng
3. Khi access token hết hạn, client gọi `POST /auth/refresh` để lấy token mới
4. Khi logout, refresh token bị thu hồi (xoá khỏi DB)
5. Nếu refresh token đã được rotate, token cũ không thể dùng lại

---

## Pagination Pattern

**Request:** `GET /endpoint?cursor=<opaqueCursor>&limit=20`

**Response:**
```json
{
  "data": [...],
  "meta": {
    "nextCursor": "opaque-cursor-string",
    "hasNextPage": true,
    "limit": 20
  }
}
```

- `cursor` = `undefined` cho page đầu tiên
- `limit` default = 20, max = 100
- `nextCursor` = `undefined` khi không còn page tiếp theo

---

## Response Envelope

**Success (mặc định):**
```json
{
  "data": <response_data>
}
```
Hoặc với meta:
```json
{
  "data": [...],
  "meta": { "nextCursor": "...", "hasNextPage": true, "limit": 20 }
}
```

**Các endpoint bypass envelope (trả thẳng):**
- `/` (GET) — AppController.getHello()
- `/health/live`, `/health/ready` — Health checks
- `/billing/webhooks/:provider` — Stripe webhooks
- `/metrics` — Prometheus metrics
- `/email/track/open/:emailId` — 1×1 GIF
- `/email/track/click/:emailId` — 302 redirect

**Error:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [...]
}
```

---

## Upload Flow (Media)

```
┌──────────┐                ┌──────────┐          ┌──────┐
│  Client   │                │   API    │          │  S3  │
└────┬─────┘                └────┬─────┘          └──┬───┘
     │                            │                    │
     │ POST /media/initiate       │                    │
     │ {purpose, filename, ...}   │                    │
     ├───────────────────────────>│                    │
     │                            │ Generate presigned │
     │<───────────────────────────┤ URL                │
     │ {uploadUrl, fields, id}    │                    │
     │                            │                    │
     │ PUT uploadUrl + file       │                    │
     ├─────────────────────────────────────────────────>│
     │                            │                    │
     │ POST /media/:id/confirm    │                    │
     ├───────────────────────────>│                    │
     │                            │ Verify in S3       │
     │                            ├───────────────────>│
     │<───────────────────────────┤                    │
     │ {status: "READY"}         │                    │
```

---

## Data Flow Diagrams

### Job Application Flow
```
Candidate                      Employer
    │                             │
    │  POST /jobs                 │  (Employer tạo job)
    ├────────────────────────────>│
    │                             │
    │  POST /jobs/:id/publish     │
    ├────────────────────────────>│
    │                             │
    │  GET /jobs                  │  (Candidate tìm job)
    │<────────────────────────────┤
    │                             │
    │  POST /jobs/:jobId/apps     │  (Candidate nộp đơn)
    ├────────────────────────────>│
    │                             │
    │  PATCH /apps/:id/status     │  (Employer update status)
    │<────────────────────────────┤
    │                             │
    │  POST /notifications        │  (WebSocket push)
    │<════════════════════════════┤
```

### Connection Flow
```
User A                         User B
  │                               │
  │  POST /connections            │  (A gửi lời mời)
  │  {toUserId: B}                │
  ├──────────────────────────────>│
  │                               │
  │  GET /connections/pending     │  (B xem lời mời)
  │<──────────────────────────────┤
  │                               │
  │  PATCH /connections/:id/accept│  (B chấp nhận)
  │<──────────────────────────────┤
  │                               │
  │  WebSocket: notification:new  │  (A nhận thông báo)
  │<══════════════════════════════┤
```

### Messaging Flow (Real-time)
```
User A                    API/WS                     User B
  │                         │                          │
  │  POST /conversations    │                          │
  ├────────────────────────>│                          │
  │  {conversation}         │                          │
  │<────────────────────────┤                          │
  │                         │                          │
  │  WS: conversation:join  │                          │
  ├────────────────────────>│                          │
  │                         │                          │
  │  POST /conversations/   │                          │
  │  :id/messages           │                          │
  ├────────────────────────>│                          │
  │                         │  WS: message:new         │
  │                         ├══════════════════════════>│
  │  WS: typing:started     │                          │
  │<════════════════════════┤  (B đang gõ)             │
  │                         │  WS: typing:stopped      │
  │<════════════════════════┤                          │
  │                         │                          │
  │                         │  WS: message:new         │
  │<════════════════════════┤  (B gửi tin)             │
```

---

## Role & Permission Matrix

| Role | Endpoints |
|---|---|
| **Anonymous** | Auth (register, login, refresh, password reset), health, email tracking, public profiles/companies/jobs feed, search suggest |
| **User (email unverified)** | Tất cả user endpoints trừ các endpoint yêu cầu `@VerifiedEmail()` |
| **User (email verified)** | Tất cả user endpoints + create job, create post, messaging, apply |
| **Company OWNER/ADMIN** | Company management, billing (OWNER), member management |
| **Company MEMBER** | View company data, job management nếu được phân quyền |
| **Billing Admin** | Xem subscription, invoices, payment methods |
| **Admin** | Admin panel endpoints |
| **Super Admin** | Admin management (CRUD admins) |
| **Moderator** | Moderation endpoints |

### Verified Email Required (`@VerifiedEmail()`)
- `POST /jobs`, `POST /jobs/:id/publish`, `POST /jobs/:jobId/applications`
- `POST /conversations`, `POST /conversations/:id/messages`
- `POST /posts`, `PATCH /posts/:id`, `DELETE /posts/:id`
- `POST /posts/:id/share`, `POST /posts/:id/comments`, `PATCH /posts/comments/:id`, `DELETE /posts/comments/:id`
- `POST /posts/:id/reactions`, `DELETE /posts/reactions/:id`
- `POST /posts/:id/save`, `DELETE /posts/:id/save`, `POST /posts/:id/hide`, `DELETE /posts/:id/hide`
- `POST /companies/:companyId/subscription`
- `POST /companies/:companyId/subscription/change-plan`
- Group conversation endpoints

---

## Database Entity Relationships (cốt lõi)

```
User ── Profile (1:1)
User ── CompanyMember ── Company
User ── Connection (requester/addressee)
User ── Follow (follower/followee)
User ── Block (blocker/blocked)
User ── Notification
User ── devices (UserDevice)

Company ── Job ── Application ── User (candidate)
Company ── Job ── Application ── Note
Company ── RecruiterSeat
Company ── Subscription ── Plan

Post ── Comment ── User
Post ── Reaction ── User
Post ── SavedPost ── User
Post ── HiddenPost ── User

Conversation ── ConversationParticipant ── User
Conversation ── Message ── User (sender)
Message ── MessageReadState ── User

Company ── TalentPool ── TalentPoolCandidate ── User
Company ── Interview
Company ── Scorecard
Company ── Offer ── User (candidate)

MediaAsset ── User (owner)
```

---

*Generated from source code — last updated 2026-06-21.*
