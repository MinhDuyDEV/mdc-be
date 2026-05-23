# ADR-0002: Media Visibility Model

## Status

Accepted — 2026-05-23

## Context

Current media authorization is owner-only. That prevents serving public avatars, post images, company logos, and other intentionally public assets.

Media visibility can be derived from parent entities, but downloads must be fast and authorization logic must be explicit. Derived visibility would require joins and parent-specific logic on every read path.

## Decision

Persist `visibility` on `MediaAsset` with values:

- `PRIVATE`
- `CONNECTIONS_ONLY`
- `PUBLIC`

Default new assets to `PRIVATE` unless upload flow explicitly sets another visibility.

## Alternatives Considered

- **Derived visibility from parent entities:** rejected because every media read would need parent-specific joins and rule logic.
- **Persisted visibility column:** accepted because it makes authorization fast and explicit.

## Consequences

- Public assets can be served without owner-only checks.
- Backfill must correctly classify existing assets.
- Upload flows must set visibility intentionally.
- Privacy behavior becomes inspectable at media-row level.

## Blocks

- Phase 3 Task 3.1 — add visibility to `MediaAsset`.
- Phase 3 Task 3.2 — rewrite media authorization.
- Phase 3 Task 3.3 — backfill existing asset visibility.
- Phase 3 Task 3.4 — update upload flow.
