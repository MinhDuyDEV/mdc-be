<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Posts DTOs

## Purpose
Data transfer objects for social post management including creation, updates, comments, reactions, and listing.

## Key Files
| File | Description |
|------|-------------|
| create-post.dto.ts | Validates post creation (content, media attachments, visibility, mentions, hashtags) |
| update-post.dto.ts | Validates post updates with partial field support |
| create-comment.dto.ts | Validates comment creation (post ID, content, parent comment for threading) |
| update-comment.dto.ts | Validates comment updates |
| create-reaction.dto.ts | Validates reaction creation (post/comment ID, reaction type) |
| list-posts-query.dto.ts | Query parameters for post listing with filters, pagination, and sorting |
| post-response.dto.ts | Response structure for post data with author, stats, and user interactions |
| comment-response.dto.ts | Response structure for comment data with threading support |

## For AI Agents

### Working In This Directory
- Post content is validated for length (1-5000 chars) and sanitized for XSS
- Mentions and hashtags are extracted from content (see `mention-hashtag.util.ts`)
- Visibility options: PUBLIC, CONNECTIONS, PRIVATE
- Comments support threading (parent comment ID for replies)
- Reactions use predefined types (LIKE, CELEBRATE, SUPPORT, INSIGHTFUL, CURIOUS)
- Response DTOs include engagement stats (likes, comments, shares)

### Testing Requirements
- Test post creation with content, media, mentions, hashtags
- Test mention/hashtag extraction utility
- Test comment threading (parent-child relationships)
- Test reaction validation (valid/invalid types)
- Test visibility enforcement in list queries
- Verify response DTO includes user's interaction state (liked, commented)
- Run tests: `npm test -- src/posts`

### Common Patterns
- Post content: `@IsString() @MinLength(1) @MaxLength(5000) content: string`
- Visibility: `@IsEnum(PostVisibility) visibility: PostVisibility`
- Media: `@IsOptional() @IsArray() @IsUUID('4', { each: true }) mediaIds?: string[]`
- Comment threading: `@IsOptional() @IsUUID() parentCommentId?: string`
- Reactions: `@IsEnum(ReactionType) type: ReactionType`

## Dependencies

### Internal
- Used by `PostsController` for request/response validation
- Used by `PostsService` for business logic
- Integrates with `PostsPolicyService` for authorization
- Uses `mention-hashtag.util.ts` for content parsing
- References `../../media/` for attachment handling

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
