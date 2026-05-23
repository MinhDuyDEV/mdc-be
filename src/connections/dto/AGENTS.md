<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Connections DTOs

## Purpose
Data transfer objects for professional connection requests and relationship management. Validates connection operations between users.

## Key Files
| File | Description |
|------|-------------|
| send-connection-request.dto.ts | Validates connection request creation (recipient ID, optional message) |
| connection-response.dto.ts | Response structure for connection data with user profiles and status |

## For AI Agents

### Working In This Directory
- Connection requests require recipient user ID validation
- Optional message field for personalized connection requests (max 500 chars)
- Response DTOs include sender/recipient profiles and connection status
- Connection status values: PENDING, ACCEPTED, REJECTED, BLOCKED
- Duplicate connection requests are prevented at service layer

### Testing Requirements
- Test connection request with valid/invalid recipient IDs
- Test message length validation (0, 500, 501 chars)
- Test response DTO serialization with nested user profiles
- Verify duplicate request prevention
- Run tests: `npm test -- src/connections`

### Common Patterns
- Request DTO: `@IsUUID() recipientId: string; @IsOptional() @MaxLength(500) message?: string`
- Response DTO: `{ id, sender: {...}, recipient: {...}, status, createdAt }`
- Status enum: `@IsEnum(ConnectionStatus) status: ConnectionStatus`

## Dependencies

### Internal
- Used by `ConnectionsController` for request/response validation
- Used by `ConnectionsService` for business logic
- References `ConnectionStatus` enum from `@prisma/client`
- Integrates with `ConnectionsPolicyService` for authorization

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
