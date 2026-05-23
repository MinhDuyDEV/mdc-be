# ADR-0007: Schema Organization

## Status

Accepted — 2026-05-23

## Context

`prisma/schema.prisma` is growing. Prisma multi-file schema support in Prisma 6 is experimental and requires preview behavior.

Schema organization should improve maintainability without creating toolchain stability risk.

## Decision

Keep a single `schema.prisma` file and organize it with region comments. Revisit multi-file schema when Prisma support is generally available and stable.

## Alternatives Considered

- **Prisma multi-file schema:** rejected for now due to stability risk.
- **Region comments in single schema file:** accepted because it improves navigation without changing Prisma behavior.

## Consequences

- No preview feature needed.
- Schema remains one file, but grouped by domain regions.
- Future migration to multi-file remains possible when Prisma support matures.

## Blocks

- Phase 7 Task 7.2 — add schema region comments.
