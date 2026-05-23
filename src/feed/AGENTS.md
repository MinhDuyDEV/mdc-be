<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# feed/

## Purpose

Personalized content feed module aggregating posts, job recommendations, and network updates for users. Implements feed ranking algorithms, pagination, and real-time updates.

## Key Files

| File | Description |
|------|-------------|
| `feed.module.ts` | NestJS module configuration with FeedController and FeedService |
| `feed.controller.ts` | HTTP endpoints for retrieving personalized feed content |
| `feed.controller.spec.ts` | Unit tests for FeedController |
| `feed.service.ts` | Business logic for feed generation, ranking, and filtering |
| `feed.service.spec.ts` | Unit tests for FeedService |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for feed request/response payloads |

## For AI Agents

### Working In This Directory

- **Performance critical** — Feed queries must be fast; use database indexes and caching
- **Pagination** — Support cursor-based pagination for infinite scroll
- **Ranking algorithm** — Consider recency, engagement, connection strength, and user preferences
- **Content types** — Aggregate posts, job recommendations, connection updates, and company news
- **Real-time updates** — Integrate with WebSocket gateway for live feed updates
- **Privacy filtering** — Only show content the user is authorized to see

### Testing Requirements

```bash
# Unit tests
npm test -- feed.service.spec.ts

# E2E tests
npm run test:e2e -- feed.e2e-spec.ts
```

### Common Patterns

**Feed Query with Ranking:**
```typescript
@Get()
async getFeed(
  @CurrentUser() user: User,
  @Query() dto: FeedQueryDto,
) {
  const posts = await this.feedService.getPersonalizedFeed(
    user.id,
    dto.cursor,
    dto.limit,
  );
  return { data: posts, meta: { nextCursor: posts[posts.length - 1]?.id } };
}
```

**Caching Strategy:**
```typescript
const cacheKey = `feed:${userId}:${cursor}`;
const cached = await this.redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const feed = await this.generateFeed(userId, cursor);
await this.redis.setex(cacheKey, 300, JSON.stringify(feed)); // 5 min TTL
return feed;
```

## Dependencies

### Internal

- `src/auth/` — Authentication and current user context
- `src/posts/` — Post content and engagement data
- `src/jobs/` — Job recommendations
- `src/connections/` — Network graph for personalization
- `src/common/` — Pagination, response formatting, validation
- `src/infra/prisma/` — Database queries
- `src/infra/redis/` — Caching layer

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database access

<!-- MANUAL: -->
