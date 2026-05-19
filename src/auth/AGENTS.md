<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# auth

## Purpose
Authentication and authorization module providing user registration, login, JWT token management, email verification, and password reset functionality. Implements secure authentication flows with refresh token rotation, rate limiting, and audit logging.

## Key Files
| File | Description |
|------|-------------|
| `auth.module.ts` | Module configuration with JWT setup and global AuthGuard |
| `auth.controller.ts` | REST endpoints for register, login, logout, refresh, email verification, password reset |
| `auth.service.ts` | Core authentication logic for registration and login with outbox events |
| `auth.guard.ts` | Global JWT authentication guard with public route support |
| `token.service.ts` | JWT access and refresh token generation, validation, and rotation |
| `password.service.ts` | Password hashing and comparison using bcrypt |
| `email-verification.service.ts` | Email verification token generation and validation |
| `password-reset.service.ts` | Password reset token generation and confirmation |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dto/` | Data transfer objects for auth endpoints (see `dto/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- All authentication operations emit outbox events for audit trails and downstream processing
- JWT tokens use configurable secrets and expiration times from AppConfig
- Rate limiting is applied to sensitive endpoints (register, login, password reset)
- Email verification and password reset tokens expire after configurable periods
- Refresh token rotation prevents token reuse attacks
- The AuthGuard is registered globally; use `@Public()` decorator to bypass authentication

### Testing Requirements
- Test registration with duplicate emails (should return ConflictException)
- Test login with invalid credentials (should return UnauthorizedException)
- Test refresh token rotation (old token should be invalidated)
- Test email verification token expiration
- Test password reset flow end-to-end
- Verify audit logs are created for register, login, and password reset events
- Verify outbox events are emitted for UserRegistered and UserLoggedIn

### Common Patterns
- All auth operations accept optional `ip` and `userAgent` for audit logging
- Transactions ensure atomicity of user creation + audit log + outbox event
- Password reset uses timing-safe comparison to prevent enumeration attacks
- Email verification tokens are single-use and expire after 24 hours
- Refresh tokens are stored in HTTP-only cookies with secure and sameSite flags

## Dependencies

### Internal
- `../infra/prisma` - Database access for users, tokens, audit logs
- `../infra/config` - JWT secrets, token expiration, cookie settings
- `../outbox` - Event emission for UserRegistered, UserLoggedIn

### External
- `@nestjs/jwt` - JWT token generation and validation
- `@nestjs/throttler` - Rate limiting for auth endpoints
- `bcrypt` - Password hashing (via PasswordService)
