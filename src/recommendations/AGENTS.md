<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# recommendations/

## Purpose

Recommendation engine providing personalized suggestions for connections, jobs, content, and companies. Implements collaborative filtering, content-based filtering, and hybrid recommendation algorithms.

## Key Files

| File | Description |
|------|-------------|
| `recommendations.module.ts` | NestJS module configuration with RecommendationsController, RecommendationsService, and RecommendationsRepository |
| `recommendations.controller.ts` | HTTP endpoints for retrieving personalized recommendations |
| `recommendations.controller.spec.ts` | Unit tests for RecommendationsController |
| `recommendations.service.ts` | Business logic for recommendation generation and ranking |
| `recommendations.service.spec.ts` | Unit tests for RecommendationsService |
| `recommendations.repository.ts` | Data access layer for recommendation queries |
| `recommendations.repository.spec.ts` | Unit tests for repository |
| `index.ts` | Barrel export for public API |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for recommendation request/response payloads |

## For AI Agents

### Working In This Directory

- **Performance critical** — Recommendation queries can be expensive; use caching and precomputation
- **Multiple algorithms** — Support different recommendation strategies (collaborative, content-based, hybrid)
- **Personalization** — Consider user profile, connections, interests, and past behavior
- **Diversity** — Balance relevance with diversity to avoid filter bubbles
- **Real-time updates** — Refresh recommendations periodically based on new data
- **A/B testing** — Support experimentation with different recommendation algorithms

### Testing Requirements

```bash
# Unit tests
npm test -- recommendations.service.spec.ts
npm test -- recommendations.repository.spec.ts

# E2E tests
npm run test:e2e -- recommendations.e2e-spec.ts
```

### Common Patterns

**Job Recommendations:**
```typescript
@Get('jobs')
async getJobRecommendations(
  @CurrentUser() user: User,
  @Query() dto: PaginationDto,
) {
  const recommendations = await this.recommendationsService.getJobRecommendations(
    user.id,
    dto.limit,
  );
  return { data: recommendations };
}
```

**Caching Strategy:**
```typescript
const cacheKey = `recommendations:jobs:${userId}`;
const cached = await this.redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const recommendations = await this.generateJobRecommendations(userId);
await this.redis.setex(cacheKey, 3600, JSON.stringify(recommendations)); // 1 hour TTL
return recommendations;
```

## Dependencies

### Internal

- `src/auth/` — Authentication and current user context
- `src/users/` — User profile and preferences
- `src/jobs/` — Job data for recommendations
- `src/connections/` — Network graph for collaborative filtering
- `src/common/` — Response formatting, pagination, validation
- `src/infra/prisma/` — Database queries
- `src/infra/redis/` — Caching layer

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database access

<!-- MANUAL: -->
