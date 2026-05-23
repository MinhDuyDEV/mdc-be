<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Realtime Filters

## Purpose
WebSocket exception filters for handling errors in Socket.IO gateways. Provides consistent error responses for WebSocket events.

## Key Files
| File | Description |
|------|-------------|
| ws-exception.filter.ts | Global WebSocket exception filter that catches and formats errors for Socket.IO clients |

## For AI Agents

### Working In This Directory
- WebSocket exception filter transforms exceptions into client-friendly error events
- Error events include error code, message, and optional details
- Filter handles both HTTP exceptions and generic errors
- Errors are emitted to the client socket that triggered the error
- All exceptions are logged with socket context for debugging

### Testing Requirements
- Test filter with various exception types (WsException, HttpException, Error)
- Test error event format matches expected structure
- Test error emission to correct socket (not broadcast)
- Verify error logging includes socket ID and user context
- Run tests: `npm test -- src/realtime/filters`

### Common Patterns
- Filter registration: `@UseFilters(new WsExceptionFilter())` on gateway
- Error event: `socket.emit('error', { code, message, details })`
- Exception handling: `catch (error) { throw new WsException('message'); }`
- Client-side: `socket.on('error', (error) => console.error(error))`

## Dependencies

### Internal
- Used by `../chat.gateway.ts` and `../realtime.gateway.ts`
- Integrates with `../../infra/logger/` for error logging

### External
- `@nestjs/websockets` — WsException, WebSocket filter interface
- `@nestjs/common` — Exception types and utilities

<!-- MANUAL: -->
