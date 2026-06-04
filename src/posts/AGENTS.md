<!-- Parent: ../AGENTS.md -->

# Posts Module

## Purpose

The Posts module manages the social feed functionality of the platform. It handles post creation, updates, deletion, comments (with nested replies), reactions, saved posts, hidden posts, mentions, and hashtags. Posts support visibility controls (PUBLIC, CONNECTIONS_ONLY, PRIVATE) and include policy-based access control.

## Key Files

- **posts.module.ts** - Module definition importing InfraModule, OutboxCoreModule, and ConnectionsModule
- **posts.controller.ts** - REST API endpoints for posts, comments, reactions, saved/hidden posts
- **posts.service.ts** - Core business logic for post operations with transactional integrity
- **posts-policy.service.ts** - Authorization logic for post visibility and access control
- **mention-hashtag.util.ts** - Utility functions to extract @mentions and #hashtags from post content

## Subdirectories

### dto/
- `create-post.dto.ts` - Post creation with content, visibility, and media
- `update-post.dto.ts` - Post updates (content and visibility)
- `create-comment.dto.ts` - Comment creation with optional parentId for nested replies
- `update-comment.dto.ts` - Comment content updates
- `create-reaction.dto.ts` - Reaction type (LIKE, LOVE, CELEBRATE, etc.)
- `post-response.dto.ts` - Structured post response with author, hashtags, media
- `comment-response.dto.ts` - Comment response with nested replies
- `list-posts-query.dto.ts` - Pagination and filtering for post lists

## For AI Agents

### Working with Posts

1. **Post Creation Flow**:
   - Validate content and visibility
   - Extract mentions using `extractMentions()` from mention-hashtag.util
   - Extract hashtags using `extractHashtags()` from mention-hashtag.util
   - Create post in transaction
   - Upsert hashtags and increment postCount
   - Create PostHashtag links
   - Resolve mentioned users by displayName (case-insensitive)
   - Create Mention records and emit MentionCreated events
   - Attach media via PostMedia if mediaAssetIds provided
   - Emit PostCreated event to outbox

2. **Post Updates**:
   - Verify ownership (authorId === userId)
   - Update content and/or visibility
   - If content changed: delete old hashtag links, decrement counts, re-extract and link new hashtags
   - If content changed: delete old mentions, re-extract and create new mentions
   - Emit PostUpdated event

3. **Post Deletion**:
   - Soft delete: set deletedAt timestamp
   - Verify ownership or admin rights
   - Emit PostDeleted event

4. **Comments**:
   - Support nested replies via parentId
   - Verify parent comment belongs to same post
   - Increment post.commentCount on create
   - Decrement on delete
   - Post author can delete any comment on their post
   - Comment author can delete their own comment

5. **Reactions**:
   - One reaction per user per post
   - Clicking same reaction type removes it (toggle behavior)
   - Clicking different reaction type updates existing reaction
   - Increment/decrement post.reactionCount accordingly
   - Emit ReactionAdded/ReactionRemoved events

6. **Saved Posts**:
   - Upsert pattern: create or clear deletedAt
   - Soft delete on unsave

7. **Hidden Posts**:
   - User-specific feed filtering
   - Upsert on hide, delete on unhide

### Access Control

- Use `PostsPolicyService.canViewPost(viewerId, postId)` before showing post content
- PUBLIC posts: visible to all (including unauthenticated)
- CONNECTIONS_ONLY: visible to direct connections only
- PRIVATE: visible only to author
- Post owner always has full access

### Testing Requirements

- Test mention extraction with various formats: `@username`, `@user.name`, edge cases
- Test hashtag extraction: `#tag`, `#multi_word`, Unicode support
- Test nested comment replies (parentId chain)
- Test reaction toggle behavior (add, remove, change type)
- Test visibility enforcement for each PostVisibility level
- Test soft delete behavior (deletedAt filtering)
- Test concurrent reactions (idempotency)
- Test post.commentCount and post.reactionCount accuracy after operations

### Common Patterns

- **Idempotency**: Post creation uses `idempotencyService.claim()` with userId + content hash + visibility
- **Cursor Pagination**: Comments use createdAt + id cursor encoding
- **Transactional Integrity**: All mutations wrapped in `prisma.$transaction()`
- **Event Emission**: Every state change emits domain event via OutboxService
- **Soft Deletes**: Posts and comments use deletedAt, not hard deletes
- **Mention Resolution**: Case-insensitive displayName lookup, skip if user not found
- **Hashtag Normalization**: Lowercase, trim, upsert with postCount tracking

### Rate Limiting

- POST /posts: 5 requests per 60 seconds (via @Throttle decorator)
- POST /posts/:id/comments: 10 requests per 60 seconds
- POST /posts/:id/reactions: 30 requests per 60 seconds

### Error Handling

- `NotFoundException`: Post/comment not found or soft-deleted
- `ForbiddenException`: Not the author or insufficient permissions
- `BadRequestException`: Invalid parentId or validation errors

## Dependencies

### Internal
- `../infra` - PrismaService for database access
- `../outbox` - OutboxService for event emission, IdempotencyService for deduplication
- `../connections` - ConnectionsModule for visibility policy (CONNECTIONS_ONLY)
- `../common/auth` - CurrentUser decorator, AuthenticatedUser interface
- `../common/guards` - EmailVerifiedGuard for write operations
- `../common/pagination` - CursorPaginationQueryDto

### External
- `@nestjs/common` - NestJS core decorators and exceptions
- `@nestjs/throttler` - Rate limiting for write endpoints
- `@prisma/client` - PostStatus, PostVisibility enums

### Database Tables
- `posts` - Main post records with authorId, content, visibility, status, counts
- `comments` - Comments with optional parentId for nested replies
- `reactions` - User reactions to posts (type: LIKE, LOVE, etc.)
- `mentions` - @username mentions in posts
- `hashtags` - Global hashtag registry with postCount
- `post_hashtags` - Many-to-many link between posts and hashtags
- `post_media` - Links posts to MediaAsset records
- `saved_posts` - User-specific saved posts (soft deletable)
- `hidden_posts` - User-specific hidden posts for feed filtering
