import type { INestApplication, Type } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";

describe("Recruiting (e2e)", () => {
	let app: INestApplication<App> | undefined;
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(async () => {
		originalEnv = { ...process.env };
		process.env.NODE_ENV = "test";
		process.env.PORT = "3000";
		process.env.CORS_ORIGINS = "http://localhost:3000";
		process.env.BODY_JSON_LIMIT = "1mb";
		process.env.BODY_URLENCODED_LIMIT = "1mb";
		if (!process.env.DATABASE_URL) {
			process.env.DATABASE_URL =
				"postgresql://mdc:mdc_dev_password@localhost:5432/mdc?schema=public";
		}
		process.env.REDIS_URL = "redis://localhost:6379";
		process.env.HEALTH_DATABASE_TIMEOUT_MS = "1000";
		process.env.HEALTH_REDIS_TIMEOUT_MS = "1000";
		process.env.S3_ENDPOINT = "http://localhost:9000";
		process.env.S3_REGION = "us-east-1";
		process.env.S3_ACCESS_KEY_ID = "minioadmin";
		process.env.S3_SECRET_ACCESS_KEY = "minioadmin";
		process.env.S3_BUCKET = "mdc-media";
		process.env.S3_FORCE_PATH_STYLE = "true";
		process.env.HEALTH_S3_TIMEOUT_MS = "1000";
		process.env.ELASTICSEARCH_NODE = "http://localhost:9200";
		process.env.HEALTH_ELASTICSEARCH_TIMEOUT_MS = "1000";
		process.env.SMTP_HOST = "smtp.example.com";
		process.env.SMTP_PORT = "587";
		process.env.SMTP_SECURE = "false";
		process.env.SMTP_USER = "test";
		process.env.SMTP_PASS = "test";
		process.env.EMAIL_FROM = "test@example.com";
		process.env.HEALTH_MAILER_TIMEOUT_MS = "1000";
		process.env.OTEL_SERVICE_NAME = "mdc-be-test";
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
		process.env.JWT_ACCESS_SECRET = "test-access-secret-min-32-chars-long";
		process.env.JWT_REFRESH_SECRET = "test-refresh-secret-min-32-chars-long";
		process.env.COOKIE_SECRET = "test-cookie-secret-min-32-chars-long";
		process.env.COOKIE_SECURE = "false";

		const { AppModule } = jest.requireActual<{ AppModule: Type<unknown> }>(
			"./../src/app.module",
		);
		const { configureApp } = jest.requireActual<{
			configureApp: (app: INestApplication) => void;
		}>("./../src/bootstrap");
		const { HealthService } = jest.requireActual<{
			HealthService: Type<unknown>;
		}>("./../src/infra/health");
		const { PrismaService } = jest.requireActual<{
			PrismaService: Type<unknown>;
		}>("./../src/infra/prisma");
		const { StorageService } = jest.requireActual<{
			StorageService: Type<unknown>;
		}>("./../src/infra/storage");
		const { StorageHealthService } = jest.requireActual<{
			StorageHealthService: Type<unknown>;
		}>("./../src/infra/storage");
		const { SearchEngineService } = jest.requireActual<{
			SearchEngineService: Type<unknown>;
		}>("./../src/infra/search-engine");
		const { SearchEngineHealthService } = jest.requireActual<{
			SearchEngineHealthService: Type<unknown>;
		}>("./../src/infra/search-engine");
		const { MailerService } = jest.requireActual<{
			MailerService: Type<unknown>;
		}>("./../src/infra/mailer");
		const { MailerHealthService } = jest.requireActual<{
			MailerHealthService: Type<unknown>;
		}>("./../src/infra/mailer");
		const { SearchIndexService } = jest.requireActual<{
			SearchIndexService: Type<unknown>;
		}>("./../src/search");
		const { SearchService } = jest.requireActual<{
			SearchService: Type<unknown>;
		}>("./../src/search");
		const { OutboxProcessor } = jest.requireActual<{
			OutboxProcessor: Type<unknown>;
		}>("./../src/outbox");
		const { DeadLetterService } = jest.requireActual<{
			DeadLetterService: Type<unknown>;
		}>("./../src/outbox");
		const { IdempotencyService } = jest.requireActual<{
			IdempotencyService: Type<unknown>;
		}>("./../src/outbox");
		const { OutboxService } = jest.requireActual<{
			OutboxService: Type<unknown>;
		}>("./../src/outbox/outbox.service");

		const recruiterUser = {
			id: "recruiter-1",
			email: "recruiter@example.com",
			passwordHash: null,
			displayName: "R",
			emailVerifiedAt: new Date(),
			status: "ACTIVE",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const company = {
			id: "00000000-0000-0000-0000-000000000001",
			slug: "acme",
			name: "Acme",
			isVerified: true,
			isActive: true,
		};

		const recruiterMember = {
			userId: recruiterUser.id,
			companyId: company.id,
			role: "OWNER",
		};

		const profile = {
			userId: "00000000-0000-0000-0000-0000000000cc",
			headline: "Engineer",
			visibility: "PUBLIC",
		};

		const savedCandidate = {
			id: "00000000-0000-0000-0000-0000000000d1",
			companyId: company.id,
			candidateUserId: profile.userId,
			sourceId: null,
			note: null,
			createdById: recruiterUser.id,
			createdAt: new Date(),
		};

		const talentPool = {
			id: "00000000-0000-0000-0000-0000000000e1",
			companyId: company.id,
			name: "Frontend hires",
			description: null,
			createdById: recruiterUser.id,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const transactionMock: Record<string, unknown> = {
			savedCandidate: {
				create: jest.fn().mockResolvedValue(savedCandidate),
				delete: jest.fn(),
				findFirst: jest.fn().mockResolvedValue(null),
			},
			talentPool: {
				create: jest.fn().mockResolvedValue(talentPool),
				update: jest.fn().mockResolvedValue(talentPool),
				delete: jest.fn(),
				findFirst: jest.fn().mockResolvedValue(null),
			},
			talentPoolMember: {
				create: jest.fn().mockResolvedValue({}),
				delete: jest.fn(),
				findUnique: jest.fn().mockResolvedValue(null),
			},
			candidateNote: {
				create: jest.fn().mockResolvedValue({
					id: "cn-1",
					candidateUserId: profile.userId,
					companyId: company.id,
					authorUserId: recruiterUser.id,
					content: "note",
					createdAt: new Date(),
				}),
			},
			auditLog: { create: jest.fn() },
			outboxEvent: { create: jest.fn() },
		};

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(HealthService)
			.useValue({
				live: () => ({ status: "ok", checks: { api: { status: "up" } } }),
				ready: () => ({
					status: "ok",
					checks: {
						postgres: { status: "up" },
						redis: { status: "up" },
						s3: { status: "up" },
						elasticsearch: { status: "up" },
						mail: { status: "up" },
					},
				}),
			})
			.overrideProvider(PrismaService)
			.useValue({
				$connect: jest.fn(),
				$disconnect: jest.fn(),
				$queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
				$transaction: jest.fn((cb: (tx: unknown) => unknown) =>
					cb(transactionMock),
				),
				user: { findUnique: jest.fn().mockResolvedValue(recruiterUser) },
				company: {
					findUnique: jest.fn().mockResolvedValue(company),
					findFirst: jest.fn().mockResolvedValue(company),
				},
				companyMember: {
					findUnique: jest.fn().mockResolvedValue(recruiterMember),
				},
				recruiterSeat: {
					findFirst: jest.fn().mockResolvedValue({
						companyId: company.id,
						userId: recruiterUser.id,
					}),
				},
				profile: { findUnique: jest.fn().mockResolvedValue(profile) },
				savedCandidate: {
					findFirst: jest.fn().mockResolvedValue(null),
					findUnique: jest.fn().mockResolvedValue(savedCandidate),
					findMany: jest.fn().mockResolvedValue([savedCandidate]),
					count: jest.fn().mockResolvedValue(1),
					create: jest.fn().mockResolvedValue(savedCandidate),
					delete: jest.fn(),
				},
				talentPool: {
					findFirst: jest.fn().mockResolvedValue(null),
					findUnique: jest.fn().mockResolvedValue(talentPool),
					findMany: jest.fn().mockResolvedValue([talentPool]),
					count: jest.fn().mockResolvedValue(1),
					create: jest.fn().mockResolvedValue(talentPool),
					update: jest.fn().mockResolvedValue(talentPool),
					delete: jest.fn(),
				},
				talentPoolMember: {
					findUnique: jest.fn().mockResolvedValue(null),
					findMany: jest.fn().mockResolvedValue([]),
					create: jest.fn().mockResolvedValue({}),
					delete: jest.fn(),
					count: jest.fn().mockResolvedValue(0),
				},
				candidateNote: {
					findMany: jest.fn().mockResolvedValue([]),
					create: jest.fn().mockResolvedValue({
						id: "cn-1",
						candidateUserId: profile.userId,
						companyId: company.id,
						authorUserId: recruiterUser.id,
						content: "note",
						createdAt: new Date(),
					}),
				},
				auditLog: { create: jest.fn() },
				outboxEvent: { create: jest.fn() },
				recruiterSeat: {
					findFirst: jest.fn().mockResolvedValue(null),
					findMany: jest.fn().mockResolvedValue([]),
				},
				notification: {
					findFirst: jest.fn().mockResolvedValue(null),
					findMany: jest.fn().mockResolvedValue([]),
					count: jest.fn().mockResolvedValue(0),
				},
				refreshToken: {
					create: jest.fn().mockResolvedValue({}),
					findFirst: jest.fn().mockResolvedValue(null),
					update: jest.fn(),
					updateMany: jest.fn(),
				},
				verificationToken: {
					create: jest.fn(),
					findMany: jest.fn().mockResolvedValue([]),
					findFirst: jest.fn(),
					update: jest.fn(),
					updateMany: jest.fn(),
				},
				emailDelivery: {
					create: jest.fn(),
					update: jest.fn(),
				},
			})
			.overrideProvider(StorageService)
			.useValue({
				generatePresignedUploadUrl: jest.fn(),
				generatePresignedDownloadUrl: jest.fn(),
				headBucket: jest.fn(),
			})
			.overrideProvider(StorageHealthService)
			.useValue({ ping: jest.fn().mockResolvedValue(undefined) })
			.overrideProvider(SearchEngineService)
			.useValue({
				checkClusterHealth: jest.fn(),
				index: jest.fn(),
				search: jest.fn(),
				deleteByQuery: jest.fn(),
			})
			.overrideProvider(SearchEngineHealthService)
			.useValue({ ping: jest.fn().mockResolvedValue(undefined) })
			.overrideProvider(MailerService)
			.useValue({
				sendMail: jest.fn().mockResolvedValue(undefined),
				verifyConnection: jest.fn().mockResolvedValue(undefined),
			})
			.overrideProvider(MailerHealthService)
			.useValue({ ping: jest.fn().mockResolvedValue(undefined) })
			.overrideProvider(SearchService)
			.useValue({
				toTsQuery: jest.fn().mockReturnValue(""),
				tsVectorExpression: jest.fn().mockReturnValue(""),
				tsQueryExpression: jest.fn().mockReturnValue(""),
			})
			.overrideProvider(SearchIndexService)
			.useValue({
				indexDocument: jest.fn(),
				deleteByQuery: jest.fn(),
				search: jest.fn(),
			})
			.overrideProvider(OutboxProcessor)
			.useValue({ processOutbox: jest.fn(), claimEvents: jest.fn() })
			.overrideProvider(DeadLetterService)
			.useValue({ moveToDeadLetter: jest.fn(), replay: jest.fn() })
			.overrideProvider(IdempotencyService)
			.useValue({
				claim: jest.fn().mockResolvedValue({ id: "k1" }),
				cleanup: jest.fn(),
			})
			.overrideProvider(OutboxService)
			.useValue({ emit: jest.fn() })
			.compile();

		app = moduleFixture.createNestApplication({ bodyParser: false });
		configureApp(app);
		await app.init();
	});

	afterEach(async () => {
		await app?.close();
		app = undefined;
		process.env = originalEnv;
	});

	function tokenForRecruiter(): Promise<string> {
		const jwt = app!.get(JwtService);
		return jwt.signAsync({
			sub: "recruiter-1",
			email: "recruiter@example.com",
		});
	}

	// ---------------------------------------------------------------------------
	// POST /api/v1/companies/:companyId/saved-candidates
	// ---------------------------------------------------------------------------
	describe("POST /api/v1/companies/:companyId/saved-candidates", () => {
		const path =
			"/api/v1/companies/00000000-0000-0000-0000-000000000001/saved-candidates";

		it("returns 401 without auth", async () => {
			await request(app!.getHttpServer())
				.post(path)
				.send({ candidateUserId: "00000000-0000-0000-0000-0000000000cc" })
				.expect(401);
		});

		it("rejects bad companyId UUID with 400", async () => {
			const token = await tokenForRecruiter();
			await request(app!.getHttpServer())
				.post("/api/v1/companies/not-a-uuid/saved-candidates")
				.set("Authorization", `Bearer ${token}`)
				.send({ candidateUserId: "00000000-0000-0000-0000-0000000000cc" })
				.expect(400);
		});

		it("rejects missing candidateUserId with 400", async () => {
			const token = await tokenForRecruiter();
			await request(app!.getHttpServer())
				.post(path)
				.set("Authorization", `Bearer ${token}`)
				.send({})
				.expect(400);
		});

		it("rejects oversize note > 2000 chars with 400", async () => {
			const token = await tokenForRecruiter();
			await request(app!.getHttpServer())
				.post(path)
				.set("Authorization", `Bearer ${token}`)
				.send({
					candidateUserId: "00000000-0000-0000-0000-0000000000cc",
					note: "x".repeat(2001),
				})
				.expect(400);
		});

		it("returns 201 for a valid save", async () => {
			const token = await tokenForRecruiter();
			const res = await request(app!.getHttpServer())
				.post(path)
				.set("Authorization", `Bearer ${token}`)
				.send({ candidateUserId: "00000000-0000-0000-0000-0000000000cc" })
				.expect(201);
			expect(res.body.data).toBeDefined();
		});
	});

	// ---------------------------------------------------------------------------
	// GET /api/v1/companies/:companyId/saved-candidates
	// ---------------------------------------------------------------------------
	describe("GET /api/v1/companies/:companyId/saved-candidates", () => {
		const path =
			"/api/v1/companies/00000000-0000-0000-0000-000000000001/saved-candidates";

		it("returns 401 without auth", async () => {
			await request(app!.getHttpServer()).get(path).expect(401);
		});

		it("returns 200 with data envelope and meta", async () => {
			const token = await tokenForRecruiter();
			const res = await request(app!.getHttpServer())
				.get(path)
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			expect(res.body).toHaveProperty("data");
			expect(res.body).toHaveProperty("meta");
		});
	});

	// ---------------------------------------------------------------------------
	// POST/GET /api/v1/companies/:companyId/talent-pools
	// ---------------------------------------------------------------------------
	describe("Talent pools CRUD", () => {
		const path =
			"/api/v1/companies/00000000-0000-0000-0000-000000000001/talent-pools";

		it("rejects POST without auth (401)", async () => {
			await request(app!.getHttpServer())
				.post(path)
				.send({ name: "Pool" })
				.expect(401);
		});

		it("rejects empty name with 400", async () => {
			const token = await tokenForRecruiter();
			await request(app!.getHttpServer())
				.post(path)
				.set("Authorization", `Bearer ${token}`)
				.send({ name: "" })
				.expect(400);
		});

		it("rejects oversize name > 255 with 400", async () => {
			const token = await tokenForRecruiter();
			await request(app!.getHttpServer())
				.post(path)
				.set("Authorization", `Bearer ${token}`)
				.send({ name: "x".repeat(256) })
				.expect(400);
		});

		it("creates a pool with 201 for a valid name", async () => {
			const token = await tokenForRecruiter();
			const res = await request(app!.getHttpServer())
				.post(path)
				.set("Authorization", `Bearer ${token}`)
				.send({ name: "Frontend hires" })
				.expect(201);
			expect(res.body.data).toHaveProperty("id");
		});

		it("lists pools with 200 + meta", async () => {
			const token = await tokenForRecruiter();
			const res = await request(app!.getHttpServer())
				.get(path)
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			expect(res.body).toHaveProperty("data");
			expect(res.body).toHaveProperty("meta");
		});
	});
});
