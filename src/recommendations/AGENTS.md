<!-- Parent: ../AGENTS.md -->

# Recommendations Module

## Purpose

The Recommendations module provides personalized recommendations for people, jobs, and companies. It uses score-based ranking with cursor pagination, Redis caching for first-page results, and respects user notification preferences for job recommendations. The module includes a repository layer for complex scoring queries and enriches results with user/job/company details.

## Key Files

- **recommendations.module.ts** - Module definition importing InfraModule
- **recommendations.controller.ts** - REST API endpoints for people, job, and company recommendations
- **recommendations.service.ts** - Business logic with Redis caching and result enrichment
- **recommendations.repository.ts** - Score-based queries with cursor pagination utilities

## Subdirectories

### dto/
- `recommendations-query.dto.ts` - Query parameters (cursor, limit)
- `recommendations-response.dto.ts` - Generic paginated response with nextCursor
- `index.ts` - Exports for RecommendedPersonDto, RecommendedJobDto, RecommendedCompanyDto

## For AI Agents

### Working with Recommendations

1. **People Recommendations**:
   - **Scoring**: Repository returns scored user IDs (score + id pairs)
   - **Enrichment**: Fetch user details (displayName, profile, avatar) in batch
   - **Caching**: First page (no cursor) cached in Redis for 1 hour
   - **Response**: Array of RecommendedPersonDto with profile info
   - **Visibility**: No visibility filtering (assumes public profiles)

2. **Job Recommendations**:
   - **Preference Check**: Respects `notificationPreference.jobRecommendation` flag
   - **Scoring**: Repository returns scored job IDs
   - **Enrichment**: Fetch job details (title, company, location, salary, etc.)
   - **Caching**: First page cached in Redis for 1 hour
   - **Response**: Array of RecommendedJobDto with job and company info

3. **Company Recommendations**:
   - **Scoring**: Repository returns scored company IDs
   - **Enrichment**: Fetch company details (name, industry, logo, follower count)
   - **Caching**: First page cached in Redis for 1 hour
   - **Response**: Array of RecommendedCompanyDto with company info

### Cursor Pagination

- **Score-Based Cursors**: Encoded as `{ score, id }` in base64
- **Repository Pattern**: `findPeopleRecommendations(userId, cursor, limit)`
- **Sentinel Row**: Repository returns `limit + 1` rows to detect hasNextPage
- **Enrichment Slice**: Only enrich first `limit` items (skip sentinel)
- **Cursor Generation**: Use last enriched item's score + id
- **Utilities**:
  - `encodeScoreCursor(score, id)` - Create cursor string
  - `decodeCursor(cursor)` - Parse cursor string
  - `paginateScored(items, limit)` - Generic pagination helper

### Caching Strategy

- **Cache Key Pattern**: `recommendations:{type}:{userId}`
- **TTL**: 3600 seconds (1 hour)
- **Cache Condition**: Only first page (no cursor) is cached
- **Rationale**: Subsequent pages have unique cursors → near-zero cache hit rate
- **Failure Handling**: Redis errors silently ignored, continue without cache
- **Cache Writes**: Async, non-blocking (errors ignored)

### Result Enrichment

1. **Fetch Scored IDs**: Repository returns `{ id, score }[]` with sentinel row
2. **Detect hasNextPage**: `scoredIds.length > limit`
3. **Slice for Enrichment**: Take first `limit` items (exclude sentinel)
4. **Batch Fetch**: Single query for all IDs with required fields
5. **Map and Enrich**: Join scored IDs with fetched details
6. **Strip Score**: Remove internal score field from response
7. **Generate Cursor**: Use last item's score + id if hasNextPage

### Testing Requirements

- Test cursor pagination (first page, subsequent pages, last page)
- Test hasNextPage detection (sentinel row logic)
- Test Redis caching (hit, miss, failure scenarios)
- Test job recommendation preference (enabled, disabled)
- Test enrichment with missing records (skip gracefully)
- Test empty results (no recommendations)
- Test score-based ordering (descending)
- Test cursor encoding/decoding (valid, invalid)

### Common Patterns

- **Score-Based Ranking**: All recommendations use numeric scores for ordering
- **Sentinel Row Pattern**: Fetch `limit + 1` to detect hasNextPage without extra query
- **Batch Enrichment**: Single query for all IDs, not N+1
- **Graceful Degradation**: Redis failures don't break functionality
- **Preference Respect**: Job recommendations check notification preferences
- **Media URL Mapping**: Convert mediaId to `/api/v1/media/${mediaId}` URL

### Error Handling

- Redis errors: Silently ignored, continue without cache
- Missing enrichment records: Skip (don't include in results)
- Invalid cursor: Treated as no cursor (start from beginning)
- Empty results: Return `{ data: [], meta: { hasNextPage: false, limit } }`

### Performance Considerations

- First-page caching reduces database load for common queries
- Batch enrichment avoids N+1 queries
- Sentinel row pattern avoids extra COUNT query
- Redis TTL prevents stale recommendations
- Score-based pagination more efficient than offset-based

## Dependencies

### Internal
- `../infra` - PrismaService for database, Redis client for caching
- `../common/pagination` - Cursor pagination utilities

### External
- `@nestjs/common` - NestJS core decorators
- `ioredis` - Redis client for caching

### Database Tables
- `users` - User details for people recommendations
- `profiles` - Profile info (headline, location)
- `media_assets` - Avatar images
- `jobs` - Job details for job recommendations
- `companies` - Company details for company recommendations
- `notification_preferences` - Job recommendation opt-in/opt-out

### Repository Queries
- `findPeopleRecommendations(userId, cursor, limit)` - Scored user IDs
- `findJobRecommendations(userId, cursor, limit)` - Scored job IDs
- `findCompanyRecommendations(userId, cursor, limit)` - Scored company IDs
