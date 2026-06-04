<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# docs/baseline/

## Purpose

Baseline metrics and verification snapshots captured before implementation phases begin. These documents establish the starting point for measuring progress and validating improvements across phases.

## Key Files

| File | Description |
|------|-------------|
| `2026-05-baseline.md` | Phase 0 baseline snapshot: test counts (75 suites, 739 unit tests), ESLint warnings (157), TypeScript strict mode status, Docker image size (265MB), and verification commands |

## For AI Agents

### When to Read These Docs

- **Before starting a new phase** — compare current metrics against baseline to track progress
- **When optimizing performance** — use baseline Docker image size and test counts as reference points
- **When reviewing code quality improvements** — check ESLint warnings and TypeScript strict mode adoption
- **When validating phase completion** — verify that improvements meet or exceed baseline targets

### How to Use Them

1. **Capture new baselines** — before starting Phase 1, Phase 2, etc., run the verification commands and create a new baseline file
2. **Track metrics over time** — compare ESLint warnings, test counts, and image size across phases
3. **Validate improvements** — use baseline as the control to measure the impact of refactoring and optimization work
4. **Document verification commands** — include the exact commands run so future phases can reproduce the same measurements

### Baseline Verification Commands

From `2026-05-baseline.md`:

```bash
# ESLint warnings
npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 999

# Test count
npm test -- --listTests

# Docker image size
docker build -t mdc-be-baseline:latest . && docker images mdc-be-baseline:latest
```

## Dependencies

### Internal

- `src/` — Code being measured (tests, linting, build artifacts)
- `prisma/` — Database schema (may affect test setup)
- Root `AGENTS.md` references baseline for phase tracking

### External

None. Baseline files are self-contained snapshots.

## Key Metrics (Phase 0)

From `2026-05-baseline.md`:

| Metric | Value | Command |
|--------|-------|---------|
| Test suites | 75 passing | `npm test` |
| Unit tests | 739 passing | `npm test` |
| ESLint warnings | 157 | `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 999` |
| Production `tx as any` casts | 18 sites | From AUDIT_REPORT.md |
| TypeScript strict mode | Partial (strictNullChecks, noImplicitAny, strictBindCallApply enabled) | Full `strict` mode is Phase 1 work |
| Docker image size | 265,109,284 bytes | Local build of `mdc-be-baseline:latest` |

## Common Patterns

**Baseline File Structure:**

```markdown
# Baseline Verification Snapshot — YYYY-MM-DD

Captured before Phase N implementation begins.

## Source Metrics

- **Metric 1:** Value
- **Metric 2:** Value

## Verification Commands Run

### Metric 1

Command: `command here`

\`\`\`text
output here
\`\`\`

Summary: Brief interpretation of results.
```

**Comparison Template (for future phases):**

```markdown
# Phase N Metrics vs Phase 0 Baseline

| Metric | Phase 0 | Phase N | Change | Status |
|--------|---------|---------|--------|--------|
| Test suites | 75 | X | +/- Y | ✓/✗ |
| ESLint warnings | 157 | X | -Y | ✓/✗ |
| Docker image size | 265MB | X | -Y MB | ✓/✗ |
```

## Subdirectory Structure

This is a leaf directory. No subdirectories.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
