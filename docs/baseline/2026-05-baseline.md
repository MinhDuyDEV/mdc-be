# Baseline Verification Snapshot — 2026-05-23

Captured before Phase 1 implementation begins. Future phases compare against these metrics.

## Source Metrics (from AUDIT_REPORT.md and OPTIMIZATION_PLAN.md)

- **Test suites:** 75 passing in current `npm test` run.
- **Unit tests:** 739 passing in current `npm test` run.
- **ESLint warnings:** 157 under `--max-warnings 999`.
- **Production `tx as any` casts:** 18 sites in `AUDIT_REPORT.md` / `OPTIMIZATION_PLAN.md` source metrics.
- **TypeScript strict mode:** Not fully enabled. `strictNullChecks`, `noImplicitAny`, and `strictBindCallApply` are enabled; full `strict` mode remains Phase 1 work.
- **Docker image size:** 265,109,284 bytes for local `mdc-be-baseline:latest` build.

## Verification Commands Run

### ESLint Warnings

Command: `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 999`

```text
✖ 157 problems (0 errors, 157 warnings)

ESLINT_EXIT=0
```

Summary: ESLint exited 0 with 157 warnings. The authoritative baseline is the warning count above, not a machine-specific full listing. Rerun the command to inspect current warning locations. The long warning list is intentionally omitted to avoid stale partial output and absolute local filesystem paths.

### Test Count

Command: `npm test -- --listTests`

```text
> mdc-be@0.0.1 test
> jest --listTests

src/auth/password.service.spec.ts
src/common/common.spec.ts
src/outbox/outbox.processor.spec.ts
src/search/search.controller.spec.ts
src/companies/companies.service.spec.ts
src/billing/billing.service.spec.ts
src/outbox/processors/messaging.processor.spec.ts
src/jobs/jobs.service.spec.ts
src/infra/health/health.service.spec.ts
src/profiles/profiles.service.spec.ts
src/companies/companies.controller.spec.ts
src/outbox/processors/profile-search-index.processor.spec.ts
src/search/search-index.service.spec.ts
src/media/media.service.spec.ts
src/recommendations/recommendations.controller.spec.ts
src/recruiting/recruiting.service.spec.ts
src/connections/connections.controller.spec.ts
src/posts/posts.service.spec.ts
src/outbox/processors/job-search-index.processor.spec.ts
src/analytics/analytics.service.spec.ts
src/auth/auth.controller.spec.ts
src/outbox/processors/post-search-index.processor.spec.ts
src/billing/webhooks/webhook.service.spec.ts
src/email/email.service.spec.ts
src/auth/password-reset.service.spec.ts
src/applications/applications.service.spec.ts
src/moderation/moderation.service.spec.ts
src/applications/applications.controller.spec.ts
src/outbox/processors/notification.processor.spec.ts
src/profiles/profiles.controller.spec.ts
src/messaging/messaging.service.spec.ts
src/auth/token.service.spec.ts
src/billing/entitlements/entitlements.guard.spec.ts
src/media/media.controller.spec.ts
src/infra/prisma/prisma.service.spec.ts
src/connections/connections.service.spec.ts
src/auth/email-verification.service.spec.ts
src/posts/posts.controller.spec.ts
src/common/guards/roles.guard.spec.ts
src/messaging/messaging.controller.spec.ts
src/email/email.processor.spec.ts
src/auth/auth.guard.spec.ts
src/infra/storage/storage.service.spec.ts
src/users/users.service.spec.ts
src/search/search-fallback.service.spec.ts
src/auth/auth.service.spec.ts
src/search/search-query.service.spec.ts
src/common/guards/email-verified.guard.spec.ts
src/users/users.controller.spec.ts
src/recruiting/recruiting.controller.spec.ts
src/outbox/outbox.service.spec.ts
src/jobs/jobs.controller.spec.ts
src/outbox/idempotency.service.spec.ts
src/admin/admin.service.spec.ts
src/billing/entitlements/entitlements.service.spec.ts
src/notifications/notifications.service.spec.ts
src/infra/config/validate-env.spec.ts
src/app.controller.spec.ts
src/infra/logger/logger.module.spec.ts
src/recommendations/recommendations.service.spec.ts
src/feed/feed.service.spec.ts
src/infra/mailer/mailer.service.spec.ts
src/outbox/dead-letter.service.spec.ts
src/posts/posts-policy.service.spec.ts
src/messaging/messaging-policy.service.spec.ts
src/feed/feed.controller.spec.ts
src/search/search.service.spec.ts
src/recruiting/recruiting-policy.service.spec.ts
src/notifications/notifications.controller.spec.ts
src/connections/connections-policy.service.spec.ts
src/recommendations/recommendations.repository.spec.ts
src/outbox/processors/application-email.processor.spec.ts
src/infra/search-engine/search-engine.service.spec.ts
src/applications/application-status.machine.spec.ts
src/posts/mention-hashtag.util.spec.ts
TEST_LIST_EXIT=0
SPEC_PATH_COUNT=75
```

Summary: current `--listTests` output contains 75 spec-file paths after excluding npm script header and blank lines.

### Unit Test Execution

Command: `npm test -- --json --outputFile=/tmp/mdc-be-jest-results.json`

```text
{
  "success": true,
  "numTotalTestSuites": 75,
  "numPassedTestSuites": 75,
  "numFailedTestSuites": 0,
  "numTotalTests": 739,
  "numPassedTests": 739,
  "numFailedTests": 0
}
```

Summary: 75/75 suites passed; 739/739 tests passed.

### Typecheck

Command: `npm run typecheck`

```text
> mdc-be@0.0.1 typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

Summary: exit 0.

### Build

Command: `npm run build`

```text
> mdc-be@0.0.1 build
> nest build

BUILD_EXIT=0
```

Summary: exit 0.

### Prisma Validate

Command: `npx prisma validate`

```text
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
```

Summary: exit 0.

### Docker Image Size

Command: `docker build -t mdc-be-baseline . && docker image inspect mdc-be-baseline --format='IMAGE_SIZE_BYTES={{.Size}}'`

```text
#0 building with "desktop-linux" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 766B done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/node:20-alpine
#2 DONE 0.0s

#3 [internal] load .dockerignore
#3 transferring context: 117B done
#3 DONE 0.0s

#4 [builder 1/8] FROM docker.io/library/node:20-alpine@sha256:b88333c42c23fbd91596ebd7fd10de239cedab9617de04142dde7315e3bc0afa
#4 resolve docker.io/library/node:20-alpine@sha256:b88333c42c23fbd91596ebd7fd10de239cedab9617de04142dde7315e3bc0afa 0.0s done
#4 DONE 0.0s

#5 [builder 2/8] WORKDIR /app
#5 CACHED

#6 [internal] load build context
#6 transferring context: 130.39MB 1.8s done
#6 DONE 1.8s

#7 [builder 3/8] COPY package*.json ./
#7 DONE 0.3s

#8 [builder 4/8] COPY prisma ./prisma/
#8 DONE 0.0s

#9 [stage-1 5/7] RUN npm ci --omit=dev
#9 3.018 npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
#9 ...

#10 [builder 5/8] RUN npm ci
#10 4.451 npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
#10 4.611 npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
#10 8.223 npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
#10 9.675 npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
#10 9.679 npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
#10 9.798 npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
#10 9.848 npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
#10 ...

#9 [stage-1 5/7] RUN npm ci --omit=dev
#9 12.62 
#9 12.62 added 465 packages, and audited 466 packages in 12s
#9 12.62 
#9 12.62 68 packages are looking for funding
#9 12.62   run `npm fund` for details
#9 12.63 
#9 12.63 1 moderate severity vulnerability
#9 12.63 
#9 12.63 To address all issues, run:
#9 12.63   npm audit fix
#9 12.63 
#9 12.63 Run `npm audit` for details.
#9 12.63 npm notice
#9 12.63 npm notice New major version of npm available! 10.8.2 -> 11.15.0
#9 12.63 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.15.0
... output intentionally truncated in this snapshot; rerun the command above for full Docker logs. Summary line below is the durable baseline value.
#10 17.84 npm notice
#10 17.84 npm notice New major version of npm available! 10.8.2 -> 11.15.0
#10 17.84 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.15.0
#10 17.84 npm notice To update run: npm install -g npm@11.15.0
#10 17.84 npm notice
#10 DONE 18.0s

#11 [builder 6/8] COPY . .
#11 DONE 0.8s

#12 [builder 7/8] RUN npx prisma generate
#12 0.988 Prisma schema loaded from prisma/schema.prisma
#12 1.891 ┌─────────────────────────────────────────────────────────┐
#12 1.891 │  Update available 6.19.3 -> 7.8.0                       │
#12 1.891 │                                                         │
#12 1.891 │  This is a major update - please follow the guide at    │
#12 1.891 │  https://pris.ly/d/major-version-upgrade                │
#12 1.891 │                                                         │
#12 1.891 │  Run the following to update                            │
#12 1.891 │    npm i --save-dev prisma@latest                       │
#12 1.891 │    npm i @prisma/client@latest                          │
#12 1.891 └─────────────────────────────────────────────────────────┘
#12 1.891 
#12 1.891 ✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 485ms
#12 1.891 
#12 1.891 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
#12 1.891 
#12 1.891 Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints
#12 1.891 
#12 DONE 1.9s

#13 [builder 8/8] RUN npm run build
#13 0.193 
#13 0.193 > mdc-be@0.0.1 build
#13 0.193 > nest build
#13 0.193 
#13 DONE 8.5s

#14 [stage-1 6/7] COPY --from=builder /app/dist ./dist
#14 DONE 0.2s

#15 [stage-1 7/7] COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
#15 DONE 0.0s

#16 exporting to image
#16 exporting layers
#16 exporting layers 12.2s done
#16 exporting image layers and metadata done
#16 naming to docker.io/library/mdc-be-baseline:latest done
#16 unpacking to docker.io/library/mdc-be-baseline:latest
#16 unpacking to docker.io/library/mdc-be-baseline:latest 3.3s done
#16 DONE 15.6s

DOCKER_BUILD_EXIT=0
IMAGE_SIZE_BYTES=265109284
```

Summary: Docker build exit 0; image size 265,109,284 bytes. Build-specific Docker Desktop URLs and image digests are omitted because the durable baseline metric is `IMAGE_SIZE_BYTES`. Runtime install reported 1 moderate npm audit vulnerability; run `npm audit` for current advisory details.

## Branch Protection Requirements

Required checks before merge to `main`:

1. **Typecheck:** `npm run typecheck` must pass.
2. **Lint:** `npm run lint` must pass. After Phase 1, lint should be strict with `--max-warnings 0`.
3. **Tests:** `npm test` must pass.
4. **Build:** `npm run build` must pass.
5. **Prisma:** `npx prisma validate` must pass.

**Current CI behavior:** lint currently tolerates 157 warnings in this baseline command. Phase 1 Task 1.4 will split mutating lint fix from verification lint and enforce strict CI behavior.

**GitHub branch protection:** Agent cannot modify settings without credentials and explicit approval. Manual follow-up required to enforce these checks in GitHub UI.

## Notes

- Baseline captured on branch: `epic/mdc-be-jct-phase-0-planning-safety-net-baseline`.
- Long command outputs are summarized inline so the committed document remains durable across machines.
- Phase 1 PRs must reduce or maintain warning count, never increase.
- Phase 1 exit criteria: 0 warnings under `--max-warnings 0`.
