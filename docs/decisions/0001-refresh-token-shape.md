# ADR-0001: Refresh Token Shape

## Status

Accepted — 2026-05-23

## Context

Refresh-token rotation is a public-traffic blocker. Current implementation hashes UUID refresh tokens with bcrypt, looks up sessions by `userId`, and does not persist token-family state. Multi-device sessions can interfere with each other, and reuse detection is not real.

Refresh tokens do not need JWT payload semantics. The server only needs to identify a token record, verify a secret, rotate it, and revoke related family tokens on reuse.

## Decision

Use opaque refresh tokens with format `<tokenId>.<base64url(secret)>`. Persist `tokenId`, `familyId`, optional `parentTokenId`, and `sha256(secret)` for verification.

Validation flow:

1. Parse token ID and secret from the opaque token.
2. Look up refresh-token row by token ID.
3. Compare stored SHA-256 hash with `sha256(secret)`.
4. Rotate within the token family.
5. Revoke the family on detected reuse.

## Alternatives Considered

- **JWT with `jti`:** rejected because refresh tokens need revocation and rotation state; JWT semantics add no useful payload value here.
- **Status quo plus `familyId`:** rejected because bcrypt is expensive for random UUID-like secrets and lookup-by-user behavior is the bug source.
- **Opaque token plus SHA-256:** accepted because it is fast, simple, revocable, and precise.

## Consequences

- Real per-token lookup and reuse detection.
- Faster validation than bcrypt for high-entropy random secrets.
- Existing refresh sessions need migration or forced re-login.
- `JWT_REFRESH_SECRET` can be removed if no remaining refresh JWT use exists. Refresh-token expiry configuration such as `JWT_REFRESH_EXPIRES_IN` remains needed for opaque-token expiration unless Phase 2 replaces it with an equivalent config key.

## Blocks

- Phase 2 Task 2.1 — schema migration for token family fields.
- Phase 2 Task 2.2 — refresh-token validation and rotation rewrite.
- Phase 2 Task 2.3 — refresh endpoint contract cleanup.
- Phase 2 Task 2.4 — refresh cookie configuration hardening.
- Phase 2 Task 2.5 — `JWT_REFRESH_SECRET` usage or removal.
