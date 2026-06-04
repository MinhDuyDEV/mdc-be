<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# docs/goals/

## Purpose

Phase-specific goals and completion tracking documents. These files define the objectives for each development phase, success criteria, and progress tracking.

## Key Files

| File | Description |
|------|-------------|
| `complete-audit-optimization.md` | Phase 1 goals for audit and optimization work (6.5KB) |

## For AI Agents

### When to Read These Docs

- **At the start of a new phase** — read the phase goals to understand objectives and success criteria
- **When planning work** — use phase goals to prioritize tasks and identify dependencies
- **When tracking progress** — check completion status against defined goals
- **When making architectural decisions** — ensure decisions align with phase objectives
- **When wrapping up a phase** — verify all goals are met before moving to the next phase

### How to Use Them

1. **Read goals before implementation** — understand what success looks like for the phase
2. **Track progress** — update completion status as work progresses
3. **Reference in commits** — link commits to specific goals they address
4. **Identify blockers** — use goals to surface dependencies and blocked work
5. **Plan next phase** — use completion status to inform planning for the next phase

### Goal File Structure

```markdown
# Phase N: Goal Title

## Objectives

- Objective 1: Description
- Objective 2: Description

## Success Criteria

- Criterion 1: Measurable outcome
- Criterion 2: Measurable outcome

## Tasks

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Task 1 | Pending | - | - |
| Task 2 | In Progress | @user | - |
| Task 3 | Completed | @user | - |

## Dependencies

- Dependency 1: Description
- Dependency 2: Description

## Risks

- Risk 1: Mitigation strategy
- Risk 2: Mitigation strategy

## Timeline

- Week 1: Tasks 1-2
- Week 2: Tasks 3-4
- Week 3: Verification and wrap-up
```

## Dependencies

### Internal

- `docs/baseline/` — Phase goals reference baseline metrics for measuring progress
- `docs/decisions/` — Phase goals may reference ADRs that constrain implementation
- `src/` — Code implementing phase goals
- Root `AGENTS.md` — References phase goals for overall project tracking

### External

None. Goal files are self-contained phase plans.

## Phase 1: Complete Audit Optimization

From `complete-audit-optimization.md`:

**Objectives:**
- Complete TypeScript strict mode migration
- Reduce ESLint warnings
- Optimize Docker image size
- Improve test coverage

**Success Criteria:**
- TypeScript strict mode fully enabled
- ESLint warnings reduced from 157 to target
- Docker image size reduced from 265MB
- Test coverage improved

**Key Metrics (from baseline):**
- Starting ESLint warnings: 157
- Starting test suites: 75
- Starting unit tests: 739
- Starting Docker image size: 265MB

## Common Patterns

**Phase Goal Template:**

```markdown
# Phase N: Title

## Objectives

Clear, measurable objectives for the phase.

## Success Criteria

Specific, verifiable criteria for phase completion.

## Tasks

Breakdown of work into trackable tasks.

## Timeline

Estimated schedule for task completion.

## Risks & Mitigations

Known risks and mitigation strategies.

## Completion Checklist

- [ ] All tasks completed
- [ ] Success criteria met
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Baseline metrics captured
```

**Progress Tracking:**

```markdown
## Progress

| Week | Completed | In Progress | Blocked |
|------|-----------|-------------|---------|
| Week 1 | Task 1, 2 | Task 3 | - |
| Week 2 | Task 3, 4 | Task 5 | Task 6 (waiting for ADR-0009) |
| Week 3 | Task 5, 6 | - | - |
```

## Subdirectory Structure

This is a leaf directory. No subdirectories.

## Phase Workflow

1. **Planning** — Create phase goals document with objectives, success criteria, and tasks
2. **Execution** — Work through tasks, updating progress status
3. **Verification** — Verify success criteria are met
4. **Baseline Capture** — Capture new baseline metrics in `docs/baseline/`
5. **Retrospective** — Document learnings and update project memory
6. **Next Phase** — Create goals for the next phase

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
