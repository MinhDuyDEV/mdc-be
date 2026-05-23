<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Messaging DTOs

## Purpose
Data transfer objects for direct messaging and conversation management. Validates message sending, conversation creation, and recruiting-specific messaging.

## Key Files
| File | Description |
|------|-------------|
| send-message.dto.ts | Validates message sending (conversation ID, content, optional attachments) |
| create-conversation.dto.ts | Validates conversation creation (participant IDs) |
| create-recruiting-conversation.dto.ts | Validates recruiter-candidate conversation creation with job context |
| message-response.dto.ts | Response structure for message data with sender info and read status |
| conversation-response.dto.ts | Response structure for conversation data with participants and last message |

## For AI Agents

### Working In This Directory
- Message content is validated for length (1-5000 chars) and sanitized for XSS
- Conversations require at least 2 participants (max 10 for group chats)
- Recruiting conversations link to specific job postings and applications
- Attachments are validated for file type and size (see media service)
- Response DTOs include read receipts and typing indicators

### Testing Requirements
- Test message validation (empty, max length, XSS attempts)
- Test conversation creation with valid/invalid participant counts
- Test recruiting conversation with job/application context
- Verify attachment validation (file types, sizes)
- Test response DTO serialization with nested data
- Run tests: `npm test -- src/messaging`

### Common Patterns
- Message content: `@IsString() @MinLength(1) @MaxLength(5000) content: string`
- Participants: `@IsArray() @IsUUID('4', { each: true }) @ArrayMinSize(2) @ArrayMaxSize(10) participantIds: string[]`
- Recruiting context: `@IsUUID() jobId: string; @IsUUID() applicationId: string`
- Attachments: `@IsOptional() @IsArray() @IsUUID('4', { each: true }) attachmentIds?: string[]`

## Dependencies

### Internal
- Used by `MessagingController` for request/response validation
- Used by `MessagingService` for business logic
- Integrates with `MessagingPolicyService` for authorization
- References `../../media/` for attachment handling
- Integrates with `../../realtime/` for real-time message delivery

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
