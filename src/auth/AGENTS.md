<!-- Parent: ../AGENTS.md -->

# Auth Domain

## Purpose

Authentication and authorization infrastructure for the platform. Handles user registration, login, JWT token management (access + refresh with rotation), email verification, password reset, and session management.

## Key Files

- **auth.module.ts** - Module definition with global JwtModule registration and APP_GUARD for AuthGuard
- **auth.controller.ts** - REST controller with throttled public endpoints for auth operations
- **auth.service.ts** - Core authentication logic (register, login, session revocation)
- **auth.guard.ts** - Global guard for JWT validation with `@Public()` and `@OptionalAuth()` support
- **token.service.ts** - JWT access token generation and refresh token management with rotation
- **email-verification.service.ts** - Email verification token generation and validation
- **password-reset.service.ts** - Password reset token generation and validation
- **password.service.ts** - Password hashing and comparison using bcrypt
- **token-expiry.util.ts** - Utility for parsing JWT expiry strings to milliseconds
- **dto/** - Request/response DTOs for auth operations

## Subdirectories

- **dto/** - Data transfer objects for registration, login, email verification, password reset, etc.

## For AI Agents

### Working Instructions

1. **Registration Flow**:
   - Check for existing user by email (throw 409 if exists)
   - Hash password with bcrypt via `PasswordService.hash()`
   - Create user + audit log + outbox event in transaction
   - Generate email verification token (non-blocking, log errors)
   - Return user DTO (exclude passwordHash)

2. **Login Flow**:
   - Find user by email, verify status is ACTIVE
   - Compare password with `PasswordService.compare()`
   - Generate access token (JWT) and refresh token (stored in DB)
   - Set refresh token as httpOnly cookie with secure/sameSite settings
   - Create audit log + outbox event in transaction
   - Return access token + user DTO (refresh token in cookie only)

3. **Token Management**:
   - **Access tokens**: Short-lived JWT (configurable via `jwtAccessExpiresIn`)
   - **Refresh tokens**: Long-lived, stored in DB with rotation on use
   - **Rotation**: `validateAndRotateRefreshToken()` revokes old token and issues new one
   - **Revocation**: `revokeRefreshToken()` sets `revokedAt` timestamp
   - **Session cleanup**: `revokeAllUserSessions()` revokes all user's refresh tokens

4. **AuthGuard** (global):
   - Applied globally via `APP_GUARD` provider
   - Validates JWT from `Authorization: Bearer <token>` header
   - Extracts user payload and attaches to `request.user`
   - Supports `@Public()` decorator to skip authentication
   - Supports `@OptionalAuth()` decorator for optional authentication

5. **Email Verification**:
   - Generate 32-byte random token, hash with SHA-256 before storage
   - Store hashed token with 24-hour expiry
   - Verify by hashing submitted token and comparing with stored hash
   - Set `User.emailVerifiedAt` on successful verification
   - Tokens are single-use (deleted after verification)

6. **Password Reset**:
   - Generate 32-byte random token, hash with SHA-256 before storage
   - Store hashed token with 1-hour expiry
   - Verify by hashing submitted token and comparing with stored hash
   - Update password hash and revoke all refresh tokens on successful reset
   - Tokens are single-use (deleted after reset)

7. **Cookie Configuration**:
   - Refresh token cookie: httpOnly, secure (prod), sameSite (strict/lax), path `/api/v1/auth`
   - MaxAge derived from `jwtRefreshExpiresIn` config via `parseExpiresInToMs()`
   - Clear cookie on logout with same path

8. **Throttling**:
   - Register: 3 requests per 60 seconds
   - Login: 5 requests per 60 seconds
   - Refresh: 10 requests per 60 seconds
   - Resend verification: 1 request per 60 seconds
   - Password reset request: 3 requests per 5 minutes
   - Password reset confirm: 3 requests per 5 minutes

### Testing Requirements

- Mock `PrismaService`, `OutboxService`, `PasswordService`, `TokenService`, `EmailVerificationService`, `PasswordResetService`
- Test registration (duplicate email, password hashing, audit log, outbox event)
- Test login (invalid credentials, inactive user, token generation, cookie setting)
- Test token refresh (rotation, revocation, expiry)
- Test email verification (token generation, validation, expiry, single-use)
- Test password reset (token generation, validation, expiry, single-use, session revocation)
- Test AuthGuard (valid token, expired token, missing token, @Public(), @OptionalAuth())
- Test throttling limits for all endpoints

### Common Patterns

- **Token Hashing**: Use SHA-256 for verification/reset tokens before storage
- **Single-Use Tokens**: Delete token record after successful verification/reset
- **Session Revocation**: Revoke all refresh tokens when password changes or user suspended
- **Audit Logging**: Log all auth events with IP and user agent
- **Outbox Events**: Emit domain events for registration, login, etc.
- **Email Enumeration Prevention**: Return same success message regardless of email existence

## Dependencies

### Internal (Allowed by eslint.config.mjs)

- **outbox** - OutboxService for event emission

### External

- **@nestjs/common** - Controller, service, guards, decorators
- **@nestjs/config** - ConfigService for JWT secrets and expiry
- **@nestjs/jwt** - JwtModule for token generation and validation
- **@nestjs/throttler** - Rate limiting for auth endpoints
- **bcrypt** - Password hashing (via PasswordService)
- **crypto** - Random token generation and SHA-256 hashing
- **infra** - PrismaService for database access

## Notes

- AuthGuard is applied globally via `APP_GUARD` provider
- Refresh tokens are rotated on every use (old token revoked, new token issued)
- Email verification and password reset tokens are hashed before storage
- All auth operations create audit logs with IP and user agent
- Cookie settings (secure, sameSite) are configurable via environment
- Token expiry strings (e.g., "7d", "15m") are parsed to milliseconds for cookie maxAge
- Email enumeration is prevented by returning same message for existing/non-existing emails
