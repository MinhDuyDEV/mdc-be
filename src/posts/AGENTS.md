<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:30:00Z | Updated: 2026-05-23T10:30:00Z -->

# posts/

## Purpose

Social posts module managing user-generated content including text posts, images, videos, reactions, comments, and shares. Implements LinkedIn-style feed content with mentions, hashtags, and engagement tracking.

## Key Files

| File | Description |
|------|-------------|
| `posts.module.ts` | NestJS module configuration with PostsController, PostsService, and PostsPolicyService |
| `posts.controller.ts` | HTTP endpoints for creating, editing, deleting posts and managing reactions/comments |
| `posts.controller.spec.ts` | Unit tests for PostsController |
| `posts.service.ts` | Business logic for post lifecycle, reactions, comments, and shares |
| `posts.service.spec.ts` | Unit tests for PostsService |
| `posts-policy.service.ts` | Authorization policies for post operations |
| `posts-policy.service.spec.ts` | Unit tests for policy service |
| `mention-hashtag.util.ts` | Utility functions for parsing mentions (@username) and hashtags (#tag) |
| `mention-hashtag.util.spec.ts` | Unit tests for mention/hashtag parsing |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for post request/response payloads |

## For AI Agents

### Working In This Directory

- **Privacy controls** — Posts can be public, connections-only, or private
- **Mentions** — Parse @username mentions and notify mentioned users
- **Hashtags** — Extract #hashtags for search and trending topics
- **Media attachments** — Support images, videos, and documents via media module
- **Reactions** — Support multiple reaction types (like, celebrate, support, etc.)
- **Comments** — Nested comments with threading support
- **Shares** — Track post shares and reshares

### Testing Requirements

```bash
# Unit tests
npm test -- posts.service.spec.ts
npm test -- posts-policy.service.spec.ts
npm test -- mention-hashtag.util.spec.ts

# E2E tests
npm run test:e2e -- posts.e2e-spec.ts
```

### Common Patterns

**Create Post with Mentions:**
```typescript
@Post()
async createPost(
  @CurrentUser() user: User,
  @Body() dto: CreatePostDto,
) {
  // Parse mentions and hashtags
  const mentions = extractMentions(dto.content);
  const hashtags = extractHashtags(dto.content);
  
  const post = await this.postsService.create({
    authorId: user.id,
    content: dto.content,
    visibility: dto.visibility,
    mentions,
    hashtags,
  });
  
  // Notify mentioned users
  for (const mention of mentions) {
    await this.notificationsService.create({
      userId: mention.userId,
      type: 'POST_MENTION',
      metadata: { postId: post.id, authorId: user.id },
    });
  }
  
  return { data: post };
}
```

**Authorization Check:**
```typescript
async canViewPost(userId: string, post: Post): Promise<boolean> {
  if (post.visibility === 'PUBLIC') return true;
  if (post.authorId === userId) return true;
  if (post.visibility === 'CONNECTIONS') {
    return this.connectionsService.areConnected(userId, post.authorId);
  }
  return false;
}
```

## Dependencies

### Internal

- `src/auth/` — Authentication and current user context
- `src/users/` — Author profile information
- `src/connections/` — Connection verification for privacy
- `src/media/` — Media attachment handling
- `src/notifications/` — Mention and reaction notifications
- `src/common/` — Response formatting, pagination, validation
- `src/infra/prisma/` — Database access

### External

- `@nestjs/common` — Controller, Injectable decorators
- `class-validator` — DTO validation
- `@prisma/client` — Database models

<!-- MANUAL: -->
