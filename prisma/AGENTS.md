<!-- Parent: ../AGENTS.md -->

# prisma/

Database schema, migrations, and Prisma ORM configuration for mdc-be.

## Purpose

This directory contains the Prisma schema definition (`schema.prisma`) and all database migrations for PostgreSQL 16. The schema defines 80+ models across 11 domain areas: identity/auth, profiles/companies, jobs/recruiting, applications, notifications, social graph, messaging, moderation/admin, search, and analytics.

## Key Files

| File | Description |
|------|-------------|
| `schema.prisma` | Prisma schema with 80+ models, enums, and relationships |
| `migrations/` | Timestamped SQL migrations (22 migrations from baseline to current) |
| `migration_lock.toml` | Prisma migration lock file (PostgreSQL provider) |

## Schema Overview

### Core Domains

**Identity & Auth (6 models)**
- `User` - Core user entity with email, password, status, timestamps
- `RefreshToken` - JWT refresh token family tree with revocation tracking
- `VerificationToken` - Email verification and password reset tokens
- `AuditLog` - Immutable audit trail of user actions
- `UserPreference` - User theme and language settings
- `UserDevice` - Device tracking for push notifications (future)

**Profiles & Companies (15 models)**
- `Profile` - User profile with headline, about, location, visibility
- `ProfileSkill` - Skills with proficiency levels and endorsements
- `Experience` - Work history with dates and descriptions
- `Education` - Educational background
- `Certification` - Professional certifications
- `ProfileLanguage` - Languages with proficiency levels
- `Endorsement` - Skill endorsements from other users
- `Company` - Company entity with verification, logo, cover media
- `CompanyMember` - Company membership with roles (OWNER, ADMIN, MEMBER, BILLING_ADMIN)
- `CompanyFollower` - Company followers
- `CompanyVerification` - Company verification workflow
- `CompanyEntitlement` - Feature entitlements and credit allocation
- `RecruiterSeat` - Recruiter seat allocation
- `MediaAsset` - S3-backed media (profiles, company logos, resumes, attachments)
- `Skill` - Master skill catalog

**Jobs & Recruiting (14 models)**
- `Job` - Job posting with status, employment type, workplace type, salary
- `JobSkill` - Skills required for a job
- `SavedJob` - User-saved jobs
- `JobView` - Job view analytics (user or anonymous)
- `Application` - Job application with status workflow
- `ApplicationAnswer` - Answers to custom application questions
- `ApplicationAttachment` - Resume and other attachments
- `ApplicationStatusEvent` - Audit trail of application status changes
- `ApplicationNote` - Recruiter notes on applications
- `SavedCandidate` - Candidates saved by recruiters
- `TalentPool` - Recruiter talent pools
- `TalentPoolCandidate` - Candidates in talent pools
- `CandidateNote` - Notes on candidates
- `CandidateSource` - Source tracking for saved candidates

**Notifications & Social (14 models)**
- `Notification` - User notifications with type, payload, read tracking
- `NotificationPreference` - Per-user notification toggles
- `Connection` - User connections with status (PENDING, ACCEPTED, DECLINED, REMOVED)
- `Follow` - User follows with status (ACTIVE, INACTIVE)
- `Block` - User blocks
- `Post` - Social posts with visibility and status
- `Comment` - Post comments with threading
- `Reaction` - Post reactions (LIKE, CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, CURIOUS)
- `Hashtag` - Hashtag catalog with post count
- `PostHashtag` - Post-hashtag associations
- `PostMedia` - Media in posts
- `SavedPost` - User-saved posts
- `HiddenPost` - User-hidden posts
- `Mention` - Mentions in posts and comments

**Messaging (5 models)**
- `Conversation` - Direct or group conversations
- `ConversationParticipant` - Conversation membership with roles
- `Message` - Messages with soft delete
- `MessageAttachment` - Message attachments (deferred to Phase 7.1)
- `MessageReadState` - Read receipts (deferred to Phase 7.1)

**Moderation & Admin (7 models)**
- `Report` - Content reports with status and priority
- `ModerationAction` - Moderation actions (WARN, REMOVE_CONTENT, SUSPEND_USER, BAN_USER, DISMISS)
- `AdminUser` - Admin users with roles (SUPER_ADMIN, ADMIN, MODERATOR)
- `AdminPermission` - Admin permissions (MANAGE_USERS, MANAGE_COMPANIES, MANAGE_JOBS, MODERATE_CONTENT, VIEW_ANALYTICS, MANAGE_ADMINS)
- `ProfileView` - Profile view analytics
- `CompanyView` - Company view analytics
- `PostImpression` - Post impression analytics

**Platform Operations (7 models)**
- `OutboxEvent` - Transactional outbox for cross-domain events
- `OutboxDeadLetter` - Failed events for manual review
- `IdempotencyKey` - Idempotency key storage for request deduplication
- `EmailDelivery` - Email delivery tracking
- `RealtimeDeliveryReceipt` - Real-time event delivery receipts
- `RecommendationFeedback` - User feedback on recommendations
- `RecommendationDismissal` - Dismissed recommendations

**Search & Analytics (9 models)**
- `SearchQueryLog` - Search query analytics
- `SearchReindexRun` - Elasticsearch reindex operations
- `SlottedCounter` - High-cardinality counter for analytics
- `AnalyticsDailyAggregate` - Daily metric aggregates
- `BillingPlan` - Billing plan definitions
- `Subscription` - Company subscriptions
- `EntitlementGrant` - Subscription entitlements
- `CreditTransaction` - Credit usage tracking
- `Invoice` - Invoices
- `InvoiceLineItem` - Invoice line items
- `PaymentProviderEvent` - Payment provider webhooks

## Indexing Strategy

### Composite Indexes (Performance Critical)

**Timeline Feeds**
- `posts(authorId, createdAt DESC, id DESC)` - Author timeline
- `posts(createdAt DESC, id DESC)` - Global feed
- `comments(postId, createdAt DESC)` - Post comments
- `notifications(userId, createdAt DESC, id DESC)` - Notification feed
- `conversations(lastMessageAt DESC, id DESC)` - Conversation list

**Search & Filtering**
- `jobs(companyId, status, deletedAt)` - Company job listings
- `jobs(status, publishedAt DESC, id DESC)` - Published jobs feed
- `applications(jobId, status, submittedAt DESC)` - Job applications
- `applications(userId, submittedAt DESC)` - User applications
- `saved_jobs(userId, createdAt DESC)` - User saved jobs
- `saved_posts(userId, createdAt DESC)` - User saved posts

**Full-Text Search (GIN indexes)**
- `profiles(search_vector)` - Profile full-text search
- `companies(search_vector)` - Company full-text search
- `jobs(search_vector)` - Job full-text search
- `posts(search_vector)` - Post full-text search

**Soft Delete Patterns**
- `saved_candidates(companyId, createdAt DESC, deletedAt)` - Active candidates only
- `talent_pools(companyId, createdAt DESC, deletedAt)` - Active pools only
- `talent_pool_candidates(talentPoolId, createdAt DESC, deletedAt)` - Active pool members
- `candidate_notes(companyId, candidateUserId, createdAt DESC, deletedAt)` - Active notes

**Outbox & Events**
- `outbox_events(status, availableAt)` - Event processing queue
- `outbox_events(aggregateType, aggregateId)` - Event lookup by aggregate
- `outbox_events(eventType)` - Event type filtering

### Partial Indexes (Raw SQL)

These are defined in migrations and cannot be expressed in Prisma schema:

- `notifications_unread_idx` - WHERE readAt IS NULL (unread notifications)
- `saved_candidates_active_unique` - WHERE deletedAt IS NULL (active candidates uniqueness)
- `talent_pools_name_active_unique` - WHERE deletedAt IS NULL (active pool name uniqueness)
- `talent_pool_candidates_active_unique` - WHERE deletedAt IS NULL (active membership uniqueness)

## Migrations

### Migration Timeline

| Migration | Date | Purpose |
|-----------|------|---------|
| `20260516080000_init_baseline` | 2026-05-16 | Initial schema with User, Profile, Company, Job, Application models |
| `20260518171303_add_phase2_models` | 2026-05-18 | Phase 2: Profiles, skills, experiences, education, certifications |
| `20260519041208_add_child_table_fk_indexes` | 2026-05-19 | Add foreign key indexes for performance |
| `20260519054241_add_companies_module` | 2026-05-19 | Company members, followers, verification, entitlements |
| `20260519141501_phase4_jobs` | 2026-05-19 | Phase 4: Job postings, skills, saved jobs, views |
| `20260519142031_phase4_applications` | 2026-05-19 | Phase 4: Applications, answers, attachments, status events, notes |
| `20260519142426_phase4_recruiting` | 2026-05-19 | Phase 4: Saved candidates, talent pools, candidate notes |
| `20260519142812_phase4_notifications` | 2026-05-19 | Phase 4: Notifications, notification preferences |
| `20260519150552_companies_role_enum_soft_delete` | 2026-05-19 | Company member role enum, soft delete for companies |
| `20260520065630_add_connections_follows_blocks` | 2026-05-20 | Connections, follows, blocks with status tracking |
| `20260520140127_add_posts_and_feed` | 2026-05-20 | Posts, comments, reactions, hashtags, saved/hidden posts |
| `20260521024815_phase7_messaging` | 2026-05-21 | Phase 7: Conversations, participants, messages, attachments, read states |
| `20260521152544_add_company_post_fts_triggers` | 2026-05-21 | Full-text search triggers for companies and posts |
| `20260521185043_phase_8_realtime_models` | 2026-05-21 | Phase 8: Realtime delivery receipts, user devices |
| `20260521192350_add_recommendation_models` | 2026-05-21 | Recommendation feedback and dismissals |
| `20260522000000_fix_comment_delete_trigger` | 2026-05-22 | Fix comment deletion trigger for cascading deletes |
| `20260522050757_phase11_moderation_admin_analytics` | 2026-05-22 | Phase 11: Reports, moderation actions, admin users, permissions, views, impressions |
| `20260522100000_add_skill_master_table` | 2026-05-22 | Skill master table for skill catalog |
| `20260522120000_fix_review_issues` | 2026-05-22 | Fix review issues from baseline |
| `20260522120100_add_moderation_action_report_fk` | 2026-05-22 | Add foreign key from moderation_actions to reports |
| `20260522140312_add_billing_models` | 2026-05-22 | Billing plans, subscriptions, entitlements, credits, invoices |
| `20260524093000_refresh_media_visibility_counts` | 2026-05-24 | Refresh media visibility counts |

### Running Migrations

```bash
# Apply pending migrations
npx prisma migrate deploy

# Create a new migration after schema changes
npx prisma migrate dev --name <migration_name>

# Reset database (dev only)
npx prisma migrate reset

# View migration status
npx prisma migrate status

# Resolve migration conflicts
npx prisma migrate resolve --rolled-back <migration_name>
```

## Prisma Workflow

### Schema Changes

1. **Modify `schema.prisma`** - Add/update models, enums, relationships
2. **Validate schema** - `npx prisma validate`
3. **Generate Prisma Client** - `npx prisma generate`
4. **Create migration** - `npx prisma migrate dev --name <descriptive_name>`
5. **Review migration SQL** - Check `prisma/migrations/<timestamp>_<name>/migration.sql`
6. **Test locally** - Run tests with `npm test`
7. **Commit** - Both schema and migration are committed to git

### Best Practices

**Naming Conventions**
- Models: PascalCase (e.g., `User`, `CompanyMember`)
- Fields: camelCase (e.g., `userId`, `createdAt`)
- Database columns: snake_case via `@map()` (e.g., `user_id`, `created_at`)
- Enums: PascalCase values (e.g., `ACTIVE`, `PENDING`)

**Relationships**
- Use explicit `@relation()` for clarity on both sides
- Name relations descriptively (e.g., `@relation("ConnectionsAsRequester")`)
- Set `onDelete` behavior: `Cascade`, `SetNull`, `Restrict`, `NoAction`
- Avoid circular dependencies; use one-directional relations when possible

**Indexes**
- Composite indexes for filtering + sorting: `@@index([field1, field2(sort: Desc)])`
- Full-text search: `@@index([searchVector], type: Gin)`
- Partial indexes (soft delete): Define in raw SQL migrations
- Foreign key indexes: Auto-created by Prisma for relations

**Timestamps**
- Always include `createdAt` and `updatedAt` on mutable entities
- Use `@default(now())` and `@updatedAt` directives
- Use `@db.Timestamptz(3)` for timezone-aware timestamps

**Soft Deletes**
- Add `deletedAt DateTime? @map("deleted_at")` field
- Include in composite indexes: `@@index([field1, createdAt(sort: Desc), deletedAt])`
- Query with `WHERE deletedAt IS NULL` in application code
- Use partial indexes for uniqueness constraints on active rows

**Enums**
- Define in schema for type safety
- Use `@db.VarChar(50)` for string enums in database
- Avoid changing enum values; create new values and migrate data

**JSON Fields**
- Use `Json` type for flexible payloads (e.g., notification payloads, metadata)
- Use `@db.JsonB` for PostgreSQL JSONB (better performance)
- Document expected structure in comments

## Database Connection

### Environment Variables

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/mdc_dev?schema=public"

# Connection pooling (PgBouncer)
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Role-specific pool limits (see ../AGENTS.md)
DATABASE_POOL_API=5
DATABASE_POOL_WORKER=20
DATABASE_POOL_REALTIME=10
```

### Local Development

```bash
# Start PostgreSQL via docker-compose
docker-compose up -d postgres

# Apply migrations
npx prisma migrate deploy

# Seed database (if seed.ts exists)
npx prisma db seed

# Open Prisma Studio (GUI)
npx prisma studio
```

## Validation & Verification

### Before Committing Schema Changes

```bash
# Validate schema syntax
npx prisma validate

# Generate Prisma Client
npx prisma generate

# Check for migration conflicts
npx prisma migrate status

# Format schema
npx prisma format
```

### Testing with Prisma

```bash
# Unit tests with mocked Prisma
npm test

# E2E tests with real database (Testcontainers)
npm run test:e2e

# Check coverage
npm run test:cov
```

## For AI Agents

### Before Modifying Schema

1. Read this file to understand the current structure
2. Check `schema.prisma` for existing models and relationships
3. Review recent migrations in `migrations/` to understand patterns
4. Validate changes with `npx prisma validate`
5. Generate migrations with `npx prisma migrate dev --name <name>`
6. Test with `npm test` before committing

### Schema Modification Checklist

- [ ] Model names are PascalCase
- [ ] Field names are camelCase with `@map()` for snake_case columns
- [ ] All mutable entities have `createdAt` and `updatedAt`
- [ ] Relationships have explicit `@relation()` with names
- [ ] Foreign keys have appropriate `onDelete` behavior
- [ ] Indexes are defined for filtering, sorting, and search
- [ ] Enums are used for fixed value sets
- [ ] JSON fields document expected structure
- [ ] Soft delete fields are included where needed
- [ ] Migration is created and reviewed
- [ ] Schema validates with `npx prisma validate`
- [ ] Tests pass with `npm test`

### Common Tasks

**Add a New Model**
1. Define model in `schema.prisma`
2. Add relationships to related models
3. Define indexes for common queries
4. Run `npx prisma migrate dev --name add_<model_name>`
5. Review generated SQL migration
6. Test with `npm test`

**Add a Relationship**
1. Add relation fields to both models
2. Use explicit `@relation()` with descriptive names
3. Set appropriate `onDelete` behavior
4. Add indexes for foreign keys
5. Run `npx prisma migrate dev --name add_<relation_name>`

**Add an Index**
1. Add `@@index()` or `@@unique()` to model
2. For partial indexes, add raw SQL in migration
3. Run `npx prisma migrate dev --name add_<index_name>`
4. Verify index creation in migration SQL

**Soft Delete a Model**
1. Add `deletedAt DateTime? @map("deleted_at")` field
2. Update indexes to include `deletedAt`
3. Add partial unique indexes in migration if needed
4. Update application queries to filter `WHERE deletedAt IS NULL`
5. Run `npx prisma migrate dev --name soft_delete_<model_name>`
