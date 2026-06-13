// @ts-check
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

const DOMAIN_MODULES = [
  "admin",
  "analytics",
  "applications",
  "auth",
  "billing",
  "companies",
  "connections",
  "email",
  "feed",
  "jobs",
  "media",
  "messaging",
  "moderation",
  "notifications",
  "observability",
  "outbox",
  "posts",
  "profiles",
  "realtime",
  "recommendations",
  "recruiting",
  "search",
  "users",
];

const DOMAIN_IMPORT_ALLOWLIST = {
  admin: ["auth", "outbox"],
  analytics: ["auth"],
  applications: ["media", "outbox"],
  auth: ["outbox"],
  billing: ["outbox"],
  companies: ["billing", "outbox"],
  connections: ["outbox"],
  email: [],
  experiments: ["auth", "outbox"],
  feed: ["connections", "posts"],
  jobs: ["billing", "outbox"],
  media: ["outbox"],
  messaging: ["connections", "media", "outbox", "recruiting"],
  moderation: ["auth", "outbox"],
  notifications: ["auth"],
  observability: [],
  outbox: ["billing", "email", "notifications", "observability", "realtime", "search"],
  posts: ["connections", "outbox"],
  profiles: ["outbox"],
  realtime: ["messaging"],
  recommendations: ["auth"],
  recruiting: ["billing", "connections", "outbox"],
  search: ["auth"],
  users: ["profiles"],
};

function restrictedDomainImportPatterns(domain, extraAllowedDomains) {
  const allowedDomains = new Set([domain, ...extraAllowedDomains]);
  return DOMAIN_MODULES.filter((candidate) => !allowedDomains.has(candidate)).flatMap(
    (candidate) => [
      `../${candidate}`,
      `../${candidate}/**`,
      `../../${candidate}`,
      `../../${candidate}/**`,
    ],
  );
}

const domainBoundaryConfigs = Object.entries(DOMAIN_IMPORT_ALLOWLIST).map(
  ([domain, extraAllowedDomains]) => ({
    files: [`src/${domain}/**/*.ts`],
    ignores: [`src/${domain}/**/*.spec.ts`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: restrictedDomainImportPatterns(domain, extraAllowedDomains),
              message:
                "Cross-domain imports must use an approved boundary. Update DOMAIN_IMPORT_ALLOWLIST in eslint.config.mjs for intentional architecture changes.",
            },
          ],
        },
      ],
    },
  }),
);

export default tseslint.config(
  {
    ignores: ["eslint.config.mjs"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: "commonjs",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Disable consistent-type-imports globally for NestJS DI compatibility.
    // NestJS uses classes as injection tokens — import type erases them at
    // runtime, breaking dependency injection. See @typescript-eslint docs.
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  ...domainBoundaryConfigs,
  {
    // Test files: jest.spyOn on mock methods triggers unbound-method false positives;
    // mocked Prisma return types frequently resolve to any.
    // NestJS ExecutionContext mocks use any-casts for switchToHttp/getRequest.
    files: ["**/*.spec.ts", "**/*.test.ts", "**/*.e2e-spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);
