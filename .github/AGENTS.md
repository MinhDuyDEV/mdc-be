<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 | Updated: 2026-05-27 -->

# .github

GitHub Actions CI/CD workflows and configuration for the mdc-be project.

## Purpose

This directory contains GitHub Actions workflows that automate testing, building, and security scanning for the mdc-be backend. Workflows run on pull requests to main and on push to main, ensuring code quality and security before deployment.

## Key Files

| File | Purpose |
|------|---------|
| `workflows/ci.yml` | Main CI pipeline (test, build, E2E) |
| `workflows/security.yml` | Security scanning (audit, CodeQL, Trivy) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `workflows/` | GitHub Actions workflow definitions (YAML) |

## Workflows Overview

### ci.yml

**Trigger:** Pull requests to main, push to main

**Purpose:** Continuous integration pipeline that validates code quality, runs tests, and builds the application.

**Jobs:**

1. **test** (runs-on: ubuntu-latest)
   - Validates Prisma schema integrity
   - Generates Prisma client
   - Runs ESLint with zero-warning tolerance
   - Runs TypeScript type checking
   - Runs unit tests with Jest
   - Builds production bundle
   - Runs E2E tests with Testcontainers

   **Environment Setup:**
   - Node.js 20 with npm cache
   - PostgreSQL 16 (via Testcontainers)
   - Redis 7 (via Testcontainers)
   - MinIO S3-compatible storage
   - Elasticsearch 8.17
   - MailHog SMTP server
   - OpenTelemetry collector

   **Key Environment Variables:**
   - `NODE_ENV: test`
   - `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mdc_test`
   - `REDIS_URL: redis://localhost:6379`
   - `S3_ENDPOINT: http://localhost:9000` (MinIO)
   - `ELASTICSEARCH_NODE: http://localhost:9200`
   - `SMTP_HOST: localhost` (MailHog)
   - `APP_PROCESS_ROLE: all` (all components enabled for testing)

2. **container-build** (runs-on: ubuntu-latest)
   - Depends on: test job
   - Builds Docker image with GitHub Actions cache
   - Tags: `mdc-be:ci-{github.sha}`
   - Does not push (cache-only mode)

**Steps:**
```
1. Checkout code
2. Setup Node.js 20 with npm cache
3. Install dependencies (npm ci)
4. Validate Prisma schema
5. Generate Prisma client
6. Run linter (npm run lint)
7. Run type check (npm run typecheck)
8. Run unit tests (npm test)
9. Build application (npm run build)
10. Run E2E tests (npm run test:e2e)
11. Build Docker image (cache only)
```

### security.yml

**Trigger:** Pull requests to main, push to main, weekly schedule (Sunday 00:00 UTC)

**Purpose:** Security scanning pipeline that audits dependencies, analyzes code, and scans container images.

**Jobs:**

1. **audit** (runs-on: ubuntu-latest)
   - Runs `npm audit --audit-level=moderate`
   - Fails on moderate or higher severity vulnerabilities
   - Runs on every PR and push

2. **codeql** (runs-on: ubuntu-latest)
   - GitHub CodeQL analysis for JavaScript/TypeScript
   - Permissions: actions:read, contents:read, security-events:write
   - Detects security vulnerabilities and code quality issues
   - Results uploaded to GitHub Security tab

3. **dependency-review** (commented out)
   - Requires GitHub Advanced Security (not enabled)
   - Would fail on high-severity dependencies
   - Enable at: https://github.com/MinhDuyDEV/mdc-be/settings/security_analysis

4. **container-scan** (runs-on: ubuntu-latest)
   - Builds Docker image: `mdc-be:security-scan`
   - Scans Dockerfile for misconfigurations (Trivy)
   - Scans built image for vulnerabilities (Trivy)
   - Fails on HIGH or CRITICAL severity issues
   - Uses pinned Trivy image: `aquasec/trivy@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e`

## For AI Agents

### Understanding Workflow Triggers

**Pull Request Trigger:**
- Runs on all PRs targeting main branch
- Validates changes before merge
- Must pass all checks before PR can be merged

**Push Trigger:**
- Runs on all commits pushed to main
- Validates merged code
- Catches issues that slipped through PR review

**Schedule Trigger (security.yml only):**
- Runs weekly on Sunday at 00:00 UTC
- Detects newly disclosed vulnerabilities
- Independent of code changes

### Workflow Dependencies

The `container-build` job in ci.yml depends on the `test` job:
```
test → container-build
```

This ensures Docker image is only built after all tests pass.

### Environment Configuration

**Test Environment Variables** (ci.yml):
- All services configured for local testing via Testcontainers
- Credentials are test-only (not production secrets)
- S3 uses MinIO with path-style URLs
- Email uses MailHog (no actual email sent)
- OpenTelemetry exports to local collector

**Security Scanning:**
- npm audit: moderate severity threshold
- CodeQL: automatic language detection
- Trivy: HIGH and CRITICAL severity only

### Working In This Directory

- **Test workflows locally** — use `act` or GitHub CLI to validate before pushing
- **Follow GitHub Actions syntax** — use official documentation for workflow schema
- **Use secrets for credentials** — never hardcode tokens or passwords
- **Pin action versions** — use `@v4` or commit SHA, not `@main`
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

### Common Issues & Solutions

**npm ci fails:**
- Check Node.js version (must be 20.x)
- Verify npm cache is working
- Check package-lock.json is committed

**Prisma validation fails:**
- Run `npx prisma validate` locally
- Check schema.prisma for syntax errors
- Ensure migrations are committed

**E2E tests timeout:**
- Testcontainers may need more time on slow runners
- Check Docker daemon is available
- Verify MDC_E2E_TESTCONTAINERS=true is set

**Container scan fails:**
- Review Dockerfile for security issues
- Check base image for vulnerabilities
- Update dependencies if needed

### Adding New Workflows

1. Create new YAML file in `workflows/`
2. Define trigger events (on: pull_request, push, schedule)
3. Specify jobs and steps
4. Use actions/checkout@v4 for code access
5. Use actions/setup-node@v4 for Node.js
6. Test locally with act (GitHub Actions emulator)

### Modifying Existing Workflows

**Before changing ci.yml:**
- Ensure all test steps remain
- Keep npm ci for dependency installation
- Maintain Prisma validation and generation
- Preserve E2E test execution

**Before changing security.yml:**
- Keep npm audit at moderate level minimum
- Maintain CodeQL analysis
- Preserve container scanning
- Document any disabled jobs with comments

### Debugging Workflow Failures

1. Check GitHub Actions tab for full logs
2. Look for specific step that failed
3. Reproduce locally with same Node.js version
4. Check environment variables are set correctly
5. Verify Docker daemon is available (for container jobs)

### Performance Optimization

**npm cache:**
- Enabled via `cache: 'npm'` in setup-node
- Speeds up `npm ci` significantly
- Automatically managed by GitHub Actions

**Docker layer cache:**
- ci.yml uses `cache-from: type=gha` and `cache-to: type=gha,mode=max`
- Speeds up Docker builds on subsequent runs
- Requires buildx action

**Parallel Jobs:**
- test and container-build can run in parallel (after test completes)
- audit, codeql, and container-scan run in parallel in security.yml
- No dependencies between security jobs

## Dependencies

### Internal

- Root `package.json` defines npm scripts used in workflows
- `test/` directory contains E2E tests run by CI
- `prisma/` migrations are validated in CI
- `Dockerfile` used for container scanning

### External

**GitHub Actions:**
- `actions/checkout@v4` - Clone repository
- `actions/setup-node@v4` - Install Node.js
- `docker/setup-buildx-action@v3` - Docker buildx for multi-platform builds
- `docker/build-push-action@v5` - Build and push Docker images
- `github/codeql-action/init@v3` - CodeQL initialization
- `github/codeql-action/analyze@v3` - CodeQL analysis

**External Tools:**
- `aquasec/trivy` - Container and Dockerfile scanning
- Node.js 20.x
- Docker (for container jobs)

## Related Documentation

- Parent: `../AGENTS.md` - Main project documentation
- CI/CD: `../README.md` - Development setup and commands
- Docker: `../Dockerfile` - Production image configuration
- Database: `../prisma/AGENTS.md` - Schema and migrations
- Tests: `../test/AGENTS.md` - E2E test configuration

<!-- MANUAL: -->
