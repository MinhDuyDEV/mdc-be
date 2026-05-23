<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T04:19:26Z | Updated: 2026-05-23T04:19:26Z -->

# workflows/

## Purpose

GitHub Actions workflow definitions for continuous integration, security scanning, and deployment automation.

## Key Files

| File | Description |
|------|-------------|
| `ci.yml` | Continuous integration workflow: runs tests, linting, and type checking on pull requests and main branch pushes |
| `security.yml` | Security scanning workflow: dependency audits, vulnerability scanning, and SAST analysis |
| `deploy.yml` | Deployment workflow: builds Docker image and deploys to production environment |

## For AI Agents

### Working In This Directory

- **Test workflows locally** — use `act` or GitHub CLI before pushing
- **Pin action versions** — use `@v4` or commit SHA, not `@main`
- **Use secrets for credentials** — reference via `${{ secrets.SECRET_NAME }}`
- **Add service containers** — use `services:` block for Postgres, Redis, etc.
- **Cache dependencies** — use `actions/cache@v4` for npm, Docker layers
- **Set up matrix builds** — test multiple Node.js versions if needed
- **Add status checks** — configure branch protection rules for required workflows

### Testing Requirements

```bash
# Validate workflow syntax
gh workflow view ci

# Test workflow locally (requires act)
act -j test

# Trigger workflow manually
gh workflow run ci

# Check workflow status
gh run list --workflow=ci

# View workflow logs
gh run view <run-id> --log
```

### Common Patterns

**CI Workflow Structure:**
```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run test:e2e
```

**Security Workflow:**
```yaml
name: Security
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=moderate
```

**Deployment Workflow:**
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ secrets.REGISTRY }}/mdc-be:${{ github.sha }}
```

## Dependencies

### Internal

- Root `package.json` defines npm scripts used in workflows
- `Dockerfile` defines container image build
- `test/` contains E2E tests run by CI
- `prisma/` migrations are validated in CI

### External

- **GitHub Actions** — CI/CD platform
- **actions/checkout@v4** — Repository checkout
- **actions/setup-node@v4** — Node.js setup
- **actions/cache@v4** — Dependency caching
- **docker/build-push-action@v5** — Docker image build and push

## Workflow Details

**CI Workflow (`ci.yml`):**
- Triggers on pull requests and main branch pushes
- Runs Postgres and Redis service containers
- Executes: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`
- Fails if any step returns non-zero exit code

**Security Workflow (`security.yml`):**
- Triggers weekly and on pull requests
- Runs `npm audit` to check for vulnerable dependencies
- Fails if moderate or higher severity vulnerabilities found

**Deploy Workflow (`deploy.yml`):**
- Triggers on main branch pushes
- Builds Docker image with multi-stage build
- Pushes image to container registry
- Deploys to production environment

<!-- MANUAL: -->
