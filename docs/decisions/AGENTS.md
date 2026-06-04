<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# docs/decisions/

## Purpose

Architecture Decision Records (ADRs) documenting Phase 0 decisions and their rationale. Each ADR captures the context, decision, and consequences for major architectural choices affecting the system.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Index of all Phase 0 ADRs with links |
| `0001-refresh-token-shape.md` | JWT refresh token structure and claims |
| `0002-media-visibility-model.md` | Media access control and visibility rules |
| `0003-deploy-target.md` | Deployment infrastructure and hosting decisions |
| `0004-idempotency-key-rollout.md` | Idempotency key strategy for request deduplication |
| `0005-counter-strategy.md` | Counter and metric aggregation approach |
| `0006-cron-leader-election.md` | Distributed cron job coordination and leader election |
| `0007-schema-organization.md` | Database schema structure and organization |
| `0008-ci-e2e-infrastructure.md` | CI/CD pipeline and end-to-end testing setup |

## For AI Agents

### When to Read These Docs

- **Before implementing a feature** — check if an ADR covers the architectural area you're working in
- **When making architectural changes** — understand the original decision before proposing alternatives
- **When onboarding to the project** — read the ADRs to understand Phase 0 decisions and constraints
- **When debugging cross-cutting concerns** — ADRs explain token shapes, visibility models, idempotency, and cron coordination
- **When planning Phase 1+ work** — ADRs may reference future phases or deprecation plans

### How to Use Them

1. **Reference ADRs in code comments** — link to the ADR when implementing the decision
2. **Propose new ADRs** — if a decision affects multiple modules or has long-term consequences, create an ADR
3. **Update ADRs when decisions change** — mark old ADRs as "Deprecated" and create new ones with rationale
4. **Use ADRs as design documentation** — they explain the "why" behind architectural choices

### ADR Template

```markdown
# ADR-NNNN: Title

## Status
Accepted | Proposed | Deprecated

## Context
Problem statement, background, and constraints that led to this decision.

## Decision
What was decided and why this approach was chosen.

## Consequences
Positive impacts, trade-offs, and negative impacts of this decision.

## References
Links to related code, issues, or other ADRs.
```

## Dependencies

### Internal

- `src/auth/` — Implements ADR-0001 (refresh token shape)
- `src/media/` — Implements ADR-0002 (media visibility model)
- `src/outbox/` — Implements ADR-0004 (idempotency keys)
- `src/jobs/` — Implements ADR-0006 (cron leader election)
- `prisma/schema.prisma` — Implements ADR-0007 (schema organization)
- `.github/workflows/` — Implements ADR-0008 (CI/E2E infrastructure)

### External

None. ADRs are self-contained architectural decisions.

## Phase 0 Decisions Summary

| ADR | Title | Status | Impact |
|-----|-------|--------|--------|
| 0001 | Refresh Token Shape | Accepted | Auth module, frontend integration |
| 0002 | Media Visibility Model | Accepted | Media service, access control |
| 0003 | Deploy Target | Accepted | Infrastructure, deployment process |
| 0004 | Idempotency-Key Rollout | Accepted | API contracts, request handling |
| 0005 | Counter Strategy | Accepted | Metrics, aggregation logic |
| 0006 | Cron Leader Election | Accepted | Job scheduling, distributed coordination |
| 0007 | Schema Organization | Accepted | Database design, migrations |
| 0008 | CI E2E Infrastructure | Accepted | Testing, deployment automation |

## Common Patterns

**ADR Status Lifecycle:**

1. **Proposed** — New decision under consideration
2. **Accepted** — Decision approved and implemented
3. **Deprecated** — Decision superseded by a newer ADR

**Referencing ADRs in Code:**

```typescript
// ADR-0001: Refresh tokens use JWT with specific claims
// See: docs/decisions/0001-refresh-token-shape.md
const refreshToken = jwt.sign(claims, secret, { expiresIn: '7d' });
```

**Creating a New ADR:**

1. Determine the next ADR number (check README.md)
2. Create `NNNN-title-slug.md` following the template
3. Update `README.md` with a link to the new ADR
4. Reference the ADR in related code and documentation

## Subdirectory Structure

This is a leaf directory. No subdirectories.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
