# Baseline Verification Snapshot — 2026-05-23

Captured before Phase 1 implementation begins. Future phases compare against these metrics.

## Source Metrics (from AUDIT_REPORT.md and OPTIMIZATION_PLAN.md)

- **Test suites:** 75 passing in current `npm test` run.
- **Unit tests:** 739 passing in current `npm test` run.
- **ESLint warnings:** 157 under `--max-warnings 999`.
- **Production `tx as any` casts:** 18 sites in `AUDIT_REPORT.md` / `OPTIMIZATION_PLAN.md` source metrics.
- **TypeScript strict mode:** OFF in `AUDIT_REPORT.md` / `OPTIMIZATION_PLAN.md`; only selected strict flags are enabled.
- **Docker image size:** 265,109,284 bytes for local `mdc-be-baseline:latest` build.

## Verification Commands Run

### ESLint Warnings

Command: `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 999`

```text
/Users/minhduydev/workspace/mdc/mdc-be/src/admin/admin.service.spec.ts
  23:32  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaService`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/analytics/analytics.service.spec.ts
  23:36  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaService`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/auth/auth.controller.spec.ts
  84:61  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; emailVerifiedAt: Date | null; status: UserStatus; createdAt: Date; } | Promise<{ id: string; email: string; emailVerifiedAt: Date | null; status: UserStatus; createdAt: Date; }>`  @typescript-eslint/no-unsafe-argument
  86:53  warning  Unsafe argument of type `any` assigned to a parameter of type `Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>`                                                                                                                                              @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/auth/auth.guard.spec.ts
   37:46  warning  Unsafe argument of type `any` assigned to a parameter of type `ExecutionContext`  @typescript-eslint/no-unsafe-argument
   57:38  warning  Unsafe argument of type `any` assigned to a parameter of type `ExecutionContext`  @typescript-eslint/no-unsafe-argument
   74:46  warning  Unsafe argument of type `any` assigned to a parameter of type `ExecutionContext`  @typescript-eslint/no-unsafe-argument
   93:38  warning  Unsafe argument of type `any` assigned to a parameter of type `ExecutionContext`  @typescript-eslint/no-unsafe-argument
  115:46  warning  Unsafe argument of type `any` assigned to a parameter of type `ExecutionContext`  @typescript-eslint/no-unsafe-argument
  141:46  warning  Unsafe argument of type `any` assigned to a parameter of type `ExecutionContext`  @typescript-eslint/no-unsafe-argument
  171:38  warning  Unsafe argument of type `any` assigned to a parameter of type `ExecutionContext`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/auth/auth.service.spec.ts
  49:7  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaService`             @typescript-eslint/no-unsafe-argument
  50:7  warning  Unsafe argument of type `any` assigned to a parameter of type `PasswordService`           @typescript-eslint/no-unsafe-argument
  51:7  warning  Unsafe argument of type `any` assigned to a parameter of type `TokenService`              @typescript-eslint/no-unsafe-argument
  52:7  warning  Unsafe argument of type `any` assigned to a parameter of type `EmailVerificationService`  @typescript-eslint/no-unsafe-argument
  53:7  warning  Unsafe argument of type `any` assigned to a parameter of type `OutboxService`             @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/auth/auth.service.ts
   76:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  153:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/auth/email-verification.service.spec.ts
   78:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; userId: string; tokenHash: string; expiresAt: Date; type: TokenType; usedAt: Date | null; } | Prisma__VerificationTokenClient<{ id: string; createdAt: Date; ... 4 more ...; usedAt: Date | null; }, never, DefaultArgs, PrismaClientOptions>`  @typescript-eslint/no-unsafe-argument
  108:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; userId: string; tokenHash: string; expiresAt: Date; type: TokenType; usedAt: Date | null; } | Prisma__VerificationTokenClient<{ id: string; createdAt: Date; ... 4 more ...; usedAt: Date | null; }, never, DefaultArgs, PrismaClientOptions>`  @typescript-eslint/no-unsafe-argument
  109:59  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...>`                                                                         @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/auth/password-reset.service.spec.ts
   97:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                                                  @typescript-eslint/no-unsafe-argument
  104:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; userId: string; tokenHash: string; expiresAt: Date; type: TokenType; usedAt: Date | null; } | Prisma__VerificationTokenClient<{ id: string; createdAt: Date; ... 4 more ...; usedAt: Date | null; }, never, DefaultArgs, PrismaClientOptions>`  @typescript-eslint/no-unsafe-argument
  176:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; userId: string; tokenHash: string; expiresAt: Date; type: TokenType; usedAt: Date | null; } | Prisma__VerificationTokenClient<{ id: string; createdAt: Date; ... 4 more ...; usedAt: Date | null; }, never, DefaultArgs, PrismaClientOptions>`  @typescript-eslint/no-unsafe-argument
  177:59  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...>`                                                                         @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/companies/companies.controller.spec.ts
   26:42  warning  Unsafe argument of type `any` assigned to a parameter of type `CompaniesService`  @typescript-eslint/no-unsafe-argument
   37:57  warning  Unsafe argument of type `any` assigned to a parameter of type `CreateCompanyDto`  @typescript-eslint/no-unsafe-argument
   44:36  warning  Unsafe argument of type `any` assigned to a parameter of type `ListCompaniesDto`  @typescript-eslint/no-unsafe-argument
   61:48  warning  Unsafe argument of type `any` assigned to a parameter of type `UpdateCompanyDto`  @typescript-eslint/no-unsafe-argument
   87:46  warning  Unsafe argument of type `any` assigned to a parameter of type `ListCompaniesDto`  @typescript-eslint/no-unsafe-argument
  112:47  warning  Unsafe argument of type `any` assigned to a parameter of type `InviteMemberDto`   @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/companies/companies.service.ts
  209:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  268:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  306:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  344:41  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaService`      @typescript-eslint/no-unsafe-argument
  375:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  430:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  521:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  627:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  684:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  810:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  928:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument
  998:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/email/email.processor.spec.ts
  58:68  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; status: EmailStatus; createdAt: Date; updatedAt: Date; errorMessage: string | null; subject: string; to: string; template: string; context: JsonValue; sentAt: Date | null; failedAt: Date | null; } | Prisma__EmailDeliveryClient<...>`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/email/email.service.spec.ts
  46:68  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; status: EmailStatus; createdAt: Date; updatedAt: Date; errorMessage: string | null; subject: string; to: string; template: string; context: JsonValue; sentAt: Date | null; failedAt: Date | null; } | Prisma__EmailDeliveryClient<...>`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/feed/feed.service.spec.ts
  24:31  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaService`             @typescript-eslint/no-unsafe-argument
  24:39  warning  Unsafe argument of type `any` assigned to a parameter of type `ConnectionsPolicyService`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/infra/logger/logger.module.spec.ts
  18:18  warning  Unsafe argument of type `any` assigned to a parameter of type `string`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/media/media.controller.spec.ts
  65:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; status: MediaStatus; createdAt: Date; updatedAt: Date; s3Bucket: string; s3Key: string; ownerId: string; purpose: string; filename: string; contentType: string; sizeBytes: number | null; etag: string | null; } | Promise<...>`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/media/media.service.spec.ts
... output intentionally truncated in this snapshot; rerun the command above for the full current listing. Summary line below is the durable baseline value.
  226:66  warning  Unsafe argument of type `any` assigned to a parameter of type `CreateReactionDto`   @typescript-eslint/no-unsafe-argument
  246:66  warning  Unsafe argument of type `any` assigned to a parameter of type `CreateReactionDto`   @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/profiles/profiles.controller.spec.ts
  39:28  warning  Unsafe argument of type `any` assigned to a parameter of type `({ endorsements: { id: string; createdAt: Date; profileId: string; profileSkillId: string; endorserId: string; }[]; skills: { id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; }[]; experiences: { ...; }[]; educations: ...`  @typescript-eslint/no-unsafe-argument
  53:28  warning  Unsafe argument of type `any` assigned to a parameter of type `({ endorsements: { id: string; createdAt: Date; profileId: string; profileSkillId: string; endorserId: string; }[]; skills: { id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; }[]; experiences: { ...; }[]; educations: ...`  @typescript-eslint/no-unsafe-argument
  65:28  warning  Unsafe argument of type `any` assigned to a parameter of type `({ endorsements: { id: string; createdAt: Date; profileId: string; profileSkillId: string; endorserId: string; }[]; skills: { id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; }[]; experiences: { ...; }[]; educations: ...`  @typescript-eslint/no-unsafe-argument
  77:28  warning  Unsafe argument of type `any` assigned to a parameter of type `({ endorsements: { id: string; createdAt: Date; profileId: string; profileSkillId: string; endorserId: string; }[]; skills: { id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; }[]; experiences: { ...; }[]; educations: ...`  @typescript-eslint/no-unsafe-argument
  92:30  warning  Unsafe argument of type `any` assigned to a parameter of type `{ data: { id: string; userId: string; headline: string | null; about: string | null; location: string | null; website: string | null; openToWork: boolean; recruitingEligible: boolean; visibility: string; createdAt: Date; updatedAt: Date; rank: number; }[]; meta: { ...; }; } | Promise<...>`                                 @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/profiles/profiles.service.spec.ts
  277:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; }[] | PrismaPromise<...>`                                                                        @typescript-eslint/no-unsafe-argument
  285:32  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[] | PrismaPromise<{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[]>`                                                                     @typescript-eslint/no-unsafe-argument
  336:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; company: string; description: string | null; title: string; location: string | null; profileId: string; companyUrl: string | null; startDate: Date; endDate: Date | null; isCurrent: boolean; }[] | PrismaPromise<...>`  @typescript-eslint/no-unsafe-argument
  390:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                           @typescript-eslint/no-unsafe-argument
  431:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                           @typescript-eslint/no-unsafe-argument
  475:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                           @typescript-eslint/no-unsafe-argument
  514:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                           @typescript-eslint/no-unsafe-argument
  526:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                           @typescript-eslint/no-unsafe-argument
  537:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                           @typescript-eslint/no-unsafe-argument
  548:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`                                           @typescript-eslint/no-unsafe-argument
  569:32  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[] | PrismaPromise<{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[]>`                                                                     @typescript-eslint/no-unsafe-argument
  572:32  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[] | PrismaPromise<{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[]>`                                                                     @typescript-eslint/no-unsafe-argument
  580:69  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; }[] | PrismaPromise<...>`                                                                        @typescript-eslint/no-unsafe-argument
  622:32  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[] | PrismaPromise<{ id: string; createdAt: Date; name: string; category: SkillCategory | null; }[]>`                                                                     @typescript-eslint/no-unsafe-argument
  662:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; company: string; description: string | null; title: string; location: string | null; profileId: string; companyUrl: string | null; startDate: Date; endDate: Date | null; isCurrent: boolean; }[] | PrismaPromise<...>`  @typescript-eslint/no-unsafe-argument
  727:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; profileId: string; startDate: Date; endDate: Date | null; school: string; degree: string; fieldOfStudy: string | null; grade: string | null; activities: string | null; }[] | PrismaPromise<...>`                        @typescript-eslint/no-unsafe-argument
  782:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; profileId: string; issuingOrganization: string; issueDate: Date; expirationDate: Date | null; credentialId: string | null; credentialUrl: string | null; }[] | PrismaPromise<...>`                         @typescript-eslint/no-unsafe-argument
  906:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; } | Prisma__ProfileSkillClient<...> | null`                                                      @typescript-eslint/no-unsafe-argument
  944:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; } | Prisma__ProfileSkillClient<...> | null`                                                      @typescript-eslint/no-unsafe-argument
  961:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; createdAt: Date; name: string; profileId: string; category: SkillCategory | null; skillId: string; proficiency: SkillProficiency | null; } | Prisma__ProfileSkillClient<...> | null`                                                      @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/profiles/profiles.service.ts
  99:37  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaTransaction`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/realtime/chat.gateway.ts
  109:5  warning  Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator  @typescript-eslint/no-floating-promises

/Users/minhduydev/workspace/mdc/mdc-be/src/realtime/realtime.gateway.ts
  75:5  warning  Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator  @typescript-eslint/no-floating-promises

/Users/minhduydev/workspace/mdc/mdc-be/src/search/search-index.service.spec.ts
  40:38  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchEngineService`  @typescript-eslint/no-unsafe-argument
  40:56  warning  Unsafe argument of type `any` assigned to a parameter of type `PrismaService`        @typescript-eslint/no-unsafe-argument
  40:68  warning  Unsafe argument of type `any` assigned to a parameter of type `PinoLogger`           @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/search/search-query.service.spec.ts
  52:7  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchEngineService`    @typescript-eslint/no-unsafe-argument
  53:7  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchService`          @typescript-eslint/no-unsafe-argument
  54:7  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchFallbackService`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/search/search.controller.spec.ts
  25:39  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchQueryService`  @typescript-eslint/no-unsafe-argument
  25:56  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchIndexService`  @typescript-eslint/no-unsafe-argument
  32:29  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchQueryDto`      @typescript-eslint/no-unsafe-argument
  40:29  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchQueryDto`      @typescript-eslint/no-unsafe-argument
  48:33  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchQueryDto`      @typescript-eslint/no-unsafe-argument
  59:34  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchQueryDto`      @typescript-eslint/no-unsafe-argument
  70:38  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchQueryDto`      @typescript-eslint/no-unsafe-argument
  81:34  warning  Unsafe argument of type `any` assigned to a parameter of type `SearchQueryDto`      @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/users/users.controller.spec.ts
  38:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; } | Promise<{ id: string; email: string; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; }>`  @typescript-eslint/no-unsafe-argument
  49:70  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; } | Promise<{ id: string; email: string; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; }>`  @typescript-eslint/no-unsafe-argument
  58:70  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; displayName: string | null; createdAt: Date; } | Promise<{ id: string; displayName: string | null; createdAt: Date; }>`                                                                                                                                    @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/src/users/users.service.spec.ts
   46:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`  @typescript-eslint/no-unsafe-argument
   73:59  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...>`         @typescript-eslint/no-unsafe-argument
   93:28  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`  @typescript-eslint/no-unsafe-argument
  104:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`  @typescript-eslint/no-unsafe-argument
  117:63  warning  Unsafe argument of type `any` assigned to a parameter of type `{ id: string; email: string; passwordHash: string | null; emailVerifiedAt: Date | null; displayName: string | null; status: UserStatus; createdAt: Date; updatedAt: Date; } | Prisma__UserClient<...> | null`  @typescript-eslint/no-unsafe-argument

/Users/minhduydev/workspace/mdc/mdc-be/test/realtime.e2e-spec.ts
  114:7   warning  Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator  @typescript-eslint/no-floating-promises
  215:55  warning  Unsafe argument of type `any` assigned to a parameter of type `string | undefined`                                                                                  @typescript-eslint/no-unsafe-argument

✖ 157 problems (0 errors, 157 warnings)

ESLINT_EXIT=0
```

### Test Count

Command: `npm test -- --listTests`

```text
> mdc-be@0.0.1 test
> jest --listTests

/Users/minhduydev/workspace/mdc/mdc-be/src/auth/password.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/common/common.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/outbox.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/search/search.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/companies/companies.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/billing/billing.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/processors/messaging.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/jobs/jobs.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/infra/health/health.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/profiles/profiles.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/companies/companies.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/processors/profile-search-index.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/search/search-index.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/media/media.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/recommendations/recommendations.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/recruiting/recruiting.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/connections/connections.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/posts/posts.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/processors/job-search-index.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/analytics/analytics.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/auth/auth.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/processors/post-search-index.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/billing/webhooks/webhook.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/email/email.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/auth/password-reset.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/applications/applications.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/moderation/moderation.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/applications/applications.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/processors/notification.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/profiles/profiles.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/messaging/messaging.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/auth/token.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/billing/entitlements/entitlements.guard.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/media/media.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/infra/prisma/prisma.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/connections/connections.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/auth/email-verification.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/posts/posts.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/common/guards/roles.guard.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/messaging/messaging.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/email/email.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/auth/auth.guard.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/infra/storage/storage.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/users/users.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/search/search-fallback.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/auth/auth.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/search/search-query.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/common/guards/email-verified.guard.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/users/users.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/recruiting/recruiting.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/outbox.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/jobs/jobs.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/idempotency.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/admin/admin.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/billing/entitlements/entitlements.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/notifications/notifications.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/infra/config/validate-env.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/app.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/infra/logger/logger.module.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/recommendations/recommendations.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/feed/feed.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/infra/mailer/mailer.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/dead-letter.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/posts/posts-policy.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/messaging/messaging-policy.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/feed/feed.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/search/search.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/recruiting/recruiting-policy.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/notifications/notifications.controller.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/connections/connections-policy.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/recommendations/recommendations.repository.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/outbox/processors/application-email.processor.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/infra/search-engine/search-engine.service.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/applications/application-status.machine.spec.ts
/Users/minhduydev/workspace/mdc/mdc-be/src/posts/mention-hashtag.util.spec.ts
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
#16 exporting manifest sha256:afb8eef517b94f754e264535ff0b2c24449095bcc1c0b16d1be8b288a08bc211
#16 exporting manifest sha256:afb8eef517b94f754e264535ff0b2c24449095bcc1c0b16d1be8b288a08bc211 done
#16 exporting config sha256:368df7d58c436ad8f7edfd0d07cf756864ba366d04b1053daf41053f8475e3fc done
#16 exporting attestation manifest sha256:6613b09309358a73609a6c4d637abb27002916dfc2d92cced1f1fd46d713c4b9 done
#16 exporting manifest list sha256:b06f6bb4c4aa4595e2cc3a9668a7c065a8bb674d477cb5b171b766c7da178c2a done
#16 naming to docker.io/library/mdc-be-baseline:latest done
#16 unpacking to docker.io/library/mdc-be-baseline:latest
#16 unpacking to docker.io/library/mdc-be-baseline:latest 3.3s done
#16 DONE 15.6s

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/wfk82kegr42445nsbb6ayljvq
DOCKER_BUILD_EXIT=0
IMAGE_SIZE_BYTES=265109284
```

Summary: Docker build exit 0; image size 265,109,284 bytes.

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
