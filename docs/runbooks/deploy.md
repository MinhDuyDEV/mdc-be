# Deploy Runbook

## Prerequisites

- Docker image built and pushed to registry
- Database migrations reviewed and approved
- Target environment variables configured

## Deployment Process

1. Merge PR to `main` branch
2. CI pipeline runs typecheck, lint, tests, E2E, and container build
3. Deploy workflow triggers on push to main
4. Manual approval required for production via `workflow_dispatch`

## Rollback

See `docs/runbooks/rollback.md` for rollback steps.
