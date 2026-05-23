<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T04:19:26Z | Updated: 2026-05-23T04:19:26Z -->

# .github/

## Purpose

GitHub configuration directory containing CI/CD workflows for automated testing, security scanning, and deployment pipelines.

## Key Files

None at this level. All configuration is in subdirectories.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `workflows/` | GitHub Actions workflow definitions for CI/CD (see `workflows/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- **Test workflows locally** — use `act` or GitHub CLI to validate before pushing
- **Follow GitHub Actions syntax** — use official documentation for workflow schema
- **Use secrets for credentials** — never hardcode tokens or passwords
- **Pin action versions** — use `@v2` or commit SHA, not `@main`
- **Add status badges** — update README.md when adding new workflows

### Testing Requirements

```bash
# Validate workflow syntax
gh workflow view <workflow-name>

# Test workflow locally (requires act)
act -j test

# Trigger workflow manually
gh workflow run <workflow-name>

# Check workflow status
gh run list --workflow=<workflow-name>
```

### Common Patterns

**Workflow Structure:**
```yaml
name: Workflow Name
on: [push, pull_request]
jobs:
  job-name:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Step name
        run: command
```

**Service Containers:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
```

**Caching Dependencies:**
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

## Dependencies

### Internal

- Root `package.json` defines npm scripts used in workflows
- `test/` directory contains E2E tests run by CI
- `prisma/` migrations are validated in CI

### External

- **GitHub Actions** — CI/CD platform
- **Docker** — Container images for service dependencies (Postgres, Redis)
- **Node.js** — Runtime for build and test steps

<!-- MANUAL: -->
