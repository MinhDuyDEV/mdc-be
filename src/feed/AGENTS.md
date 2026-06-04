<!-- Parent: ../AGENTS.md -->

# Feed Domain

## Purpose

The Feed domain aggregates posts from various sources into personalized and public feeds. It implements visibility filtering based on user relationships (connections, follows, blocks) and post visibility settings (PUBLIC, CONNECTIONS, PRIVATE). Feeds include home feed, profile feed, company feed, and hashtag feed.

## Key Files

- **feed.service.ts**: Core feed aggregation logic. Implements relationship-aware visibility filtering, block enforcement, and cursor pagination for all feed types.
- **feed.controller.ts**: REST endpoints for feed retrieval (home, profile, company, hashtag).
- **feed.module.ts**: Module definition. Imports `ConnectionsModule` for relationship queries and `PostsModule` for post data.

## Subdirectories

- **dto/**: Request/response DTOs
  - `feed-query.dto.ts`: Feed query parameters (cursor, limit)

## For AI Agents

### Working Instructions

1. **Home feed visibility rules**:
   - Own posts: all visibility levels
   - Connections' posts: PUBLIC + CONNECTIONS only
   - Followed users' posts: PUBLIC only
   - Blocked users: excluded entirely (bidirectional)
   - Hidden posts: excluded via `HiddenPost` table
   - Unauthenticated: PUBLIC posts only

2. **Profile feed visibility rules**:
   - Own profile: see all posts
   - Connected user: PUBLIC + CONNECTIONS posts
   - Non-connected user: PUBLIC posts only
   - Blocked user: empty feed (bidirectional)

3. **Company feed**: PUBLIC posts from active company members only

4. **Hashtag feed**: PUBLIC posts tagged with the hashtag only

5. **Block enforcement**: Always check `ConnectionsPolicyService.isBlocked()` before returning any content. Blocked relationships return empty feeds.

6. **Cursor pagination**: All feeds use `(createdAt DESC, id DESC)` keyset pagination with base64-encoded cursors.

7. **Performance optimization**: Batch relationship queries (connections, follows, blocks) at the start of feed generation to minimize database round-trips.

### Testing Requirements

- Test home feed visibility: verify own posts, connections' posts, follows' posts are included with correct visibility
- Test block enforcement: verify blocked users' posts are excluded from all feeds
- Test hidden posts: verify hidden posts are excluded from home feed
- Test profile feed visibility: verify visibility rules based on viewer relationship
- Test unauthenticated access: verify only PUBLIC posts are visible
- Test cursor pagination: verify `hasNextPage` and `nextCursor` correctness
- Test empty feeds: verify graceful handling of no posts, no hashtag, blocked users

### Common Patterns

- **Relationship batching**: Load all connections, follows, and blocks in parallel at feed start
- **Visibility filtering**: Build `Prisma.PostWhereInput` with OR clauses for different visibility levels
- **Block filtering**: Filter blocked user IDs from connections and follows before building query
- **Cursor encoding**: Use `encodeCursor(createdAt, id)` and `decodeCursor(cursor)` helpers
- **Pagination helper**: Use `paginateRows()` helper to extract `hasMore`, `nextCursor`, and slice results

## Dependencies

### Internal (Domain Imports)

- **connections**: `ConnectionsPolicyService` for relationship queries (`areConnected`, `isBlocked`)
- **posts**: Post data and visibility enums

### External (Infrastructure)

- **infra/prisma**: Database access via `PrismaService`
- **@prisma/client**: `ConnectionStatus`, `FollowStatus`, `PostStatus`, `PostVisibility` enums

### Allowed Imports (per eslint.config.mjs)

This domain can import from: `feed` (self), `connections`, `posts`

## Database Schema

- **Post**: Posts with authorId, visibility, status, createdAt
- **Connection**: Connection relationships with status
- **Follow**: Follow relationships with status
- **Block**: Block relationships
- **HiddenPost**: User-specific hidden posts
- **PostHashtag**: Post-hashtag associations
- **Hashtag**: Hashtag definitions

## Events Emitted

None. This domain is read-only and does not emit events.

## Feed Types

### Home Feed (`/feed`)
Authenticated: own posts + connections' posts (PUBLIC/CONNECTIONS) + follows' posts (PUBLIC), minus blocks and hidden posts
Unauthenticated: PUBLIC posts only

### Profile Feed (`/feed/users/:userId`)
Visibility based on viewer relationship (own/connected/public)

### Company Feed (`/feed/companies/:companyId`)
PUBLIC posts from active company members

### Hashtag Feed (`/feed/hashtags/:tag`)
PUBLIC posts tagged with the hashtag
