<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T04:19:26Z | Updated: 2026-05-23T04:19:26Z -->

# docs/

## Purpose

Project documentation including architecture decisions, operational runbooks, and deployment guides. This directory contains human-readable documentation for developers, operators, and stakeholders.

## Key Files

| File | Description |
|------|-------------|
| `architecture.md` | System architecture overview: outbox pattern, process roles, module responsibilities |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `runbooks/` | Operational procedures for deployment, incidents, rollback, and maintenance (see `runbooks/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Keep docs in sync with code** — update architecture.md when making structural changes
- **Use markdown format** — all docs are markdown for git-friendly diffs
- **Add runbooks for new operations** — document deployment, rollback, and incident procedures
- **Link to code** — reference specific files and line numbers when documenting patterns
- **Version decisions** — add dates to architecture decisions for historical context

### Testing Requirements

No automated tests. Verification is manual:

1. Read the documentation
2. Verify it matches current codebase state
3. Check for broken links or outdated references
4. Ensure code examples are accurate

### Common Patterns

**Architecture Documentation:**
```markdown
## Pattern Name

### Components
- Component A: Responsibility
- Component B: Responsibility

### Flow
1. Step 1
2. Step 2
3. Step 3

### Example
\`\`\`typescript
// Code example
\`\`\`
```

**Runbook Structure:**
```markdown
# Operation Name

## Prerequisites
- Requirement 1
- Requirement 2

## Steps
1. Step 1
2. Step 2

## Verification
- Check 1
- Check 2

## Rollback
- Rollback step 1
- Rollback step 2
```

## Dependencies

### Internal

- `src/` — Code documented in architecture.md
- `prisma/` — Database schema referenced in architecture docs
- Root `AGENTS.md` references docs/ for architecture context

### External

None. Documentation is self-contained.

## Key Concepts

From `architecture.md`:

**Outbox Pattern:**
- Transactional event creation via OutboxService
- Polling with `SELECT FOR UPDATE SKIP LOCKED`
- Retry with exponential backoff
- Dead-letter queue for failed events

**Process Roles:**
- `api` — HTTP routes only
- `worker` — Background processing (outbox, scheduled jobs)
- `realtime` — WebSocket connections
- `all` — Everything (local dev)

Set via `APP_PROCESS_ROLE` environment variable.

<!-- MANUAL: -->
