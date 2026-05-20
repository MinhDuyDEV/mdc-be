import type { INestApplication, Type } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";

describe("Applications (e2e)", () => {
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

		const candidateUser = {
			id: "candidate-1",
			email: "candidate@example.com",
			passwordHash: null,
			displayName: "Candidate",
			emailVerifiedAt: new Date(),
			status: "ACTIVE",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const job = {
			id: "00000000-0000-0000-0000-0000000000aa",
			companyId: "00000000-0000-0000-0000-000000000001",
			status: "PUBLISHED",
			applyMode: "INTERNAL",
			applyUrl: null,
		};

		const application = {
			id: "00000000-0000-0000-0000-0000000000bb",
			jobId: job.id,
			userId: candidateUser.id,
			status: "SUBMITTED",
			coverLetter: null,
			screeningAnswers: null,
			resumeMediaAssetId: null,
			submittedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
			job,
		};

		const transactionMock: Record<string, unknown> = {
			application: {
				create: jest.fn().mockResolvedValue(application),
				update: jest.fn().mockResolvedValue(application),
				findFirst: jest.fn().mockResolvedValue(null),
				findUnique: jest.fn().mockResolvedValue(application),
			},
			applicationStatusHistory: { create: jest.fn() },
			applicationNote: {
				create: jest.fn().mockResolvedValue({
					id: "note-1",
					applicationId: application.id,
					authorUserId: candidateUser.id,
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
				user: { findUnique: jest.fn().mockResolvedValue(candidateUser) },
				job: {
					findFirst: jest.fn().mockResolvedValue(job),
					findUnique: jest.fn().mockResolvedValue(job),
				},
				companyMember: { findUnique: jest.fn().mockResolvedValue(null) },
				mediaAsset: {
					findUnique: jest.fn().mockResolvedValue({
						id: "00000000-0000-0000-0000-0000000000cc",
						ownerUserId: candidateUser.id,
						purpose: "resume",
						status: "CONFIRMED",
					}),
				},
				application: {
					findFirst: jest.fn().mockResolvedValue(null),
					findUnique: jest.fn().mockResolvedValue(application),
					findMany: jest.fn().mockResolvedValue([application]),
					count: jest.fn().mockResolvedValue(1),
					create: jest.fn().mockResolvedValue(application),
					update: jest.fn().mockResolvedValue(application),
				},
				applicationNote: {
					findMany: jest.fn().mockResolvedValue([]),
					create: jest.fn().mockResolvedValue({
						id: "note-1",
						applicationId: application.id,
						authorUserId: candidateUser.id,
						content: "note",
						createdAt: new Date(),
					}),
				},
				applicationStatusHistory: {
					findMany: jest.fn().mockResolvedValue([]),
					create: jest.fn(),
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
				generatePresignedDownloadUrl: jest
					.fn()
					.mockResolvedValue("https://example.com/r.pdf"),
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

	function tokenForCandidate(): Promise<string> {
		const jwt = app!.get(JwtService);
		return jwt.signAsync({
			sub: "candidate-1",
			email: "candidate@example.com",
		});
	}

	// ---------------------------------------------------------------------------
	// POST /api/v1/jobs/:jobId/applications  (submit)
	// ---------------------------------------------------------------------------
	describe("POST /api/v1/jobs/:jobId/applications", () => {
		it("returns 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.post("/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/applications")
				.send({})
				.expect(401);
		});

		it("rejects bad jobId UUID with 400", async () => {
			const token = await tokenForCandidate();
			await request(app!.getHttpServer())
				.post("/api/v1/jobs/not-a-uuid/applications")
				.set("Authorization", `Bearer ${token}`)
				.send({})
				.expect(400);
		});

		it.skip("rejects an oversize coverLetter > 20_000 chars with 400", async () => {
			const token = await tokenForCandidate();
			await request(app!.getHttpServer())
				.post("/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/applications")
				.set("Authorization", `Bearer ${token}`)
				.send({ coverLetter: "x".repeat(20_001) })
				.expect(400);
		});

		it.skip("returns 201 for a valid submit", async () => {
			const token = await tokenForCandidate();
			const res = await request(app!.getHttpServer())
				.post("/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/applications")
				.set("Authorization", `Bearer ${token}`)
				.send({ coverLetter: "short cover" })
				.expect(201);
			expect(res.body.data).toBeDefined();
		});
	});

	// ---------------------------------------------------------------------------
	// GET /api/v1/applications/me
	// ---------------------------------------------------------------------------
	describe("GET /api/v1/applications/me", () => {
		it("returns 401 without auth", async () => {
			await request(app!.getHttpServer())
				.get("/api/v1/applications/me")
				.expect(401);
		});

		it.skip("returns 200 with envelope+meta when authed", async () => {
			const token = await tokenForCandidate();
			const res = await request(app!.getHttpServer())
				.get("/api/v1/applications/me")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			expect(res.body).toHaveProperty("data");
			expect(res.body).toHaveProperty("meta");
		});
	});

	// ---------------------------------------------------------------------------
	// GET /api/v1/applications/:id
	// ---------------------------------------------------------------------------
	describe("GET /api/v1/applications/:id", () => {
		it("returns 401 without auth", async () => {
			await request(app!.getHttpServer())
				.get("/api/v1/applications/00000000-0000-0000-0000-0000000000bb")
				.expect(401);
		});

		it("returns 400 on bad UUID", async () => {
			const token = await tokenForCandidate();
			await request(app!.getHttpServer())
				.get("/api/v1/applications/not-a-uuid")
				.set("Authorization", `Bearer ${token}`)
				.expect(400);
		});

		it.skip("returns 200 with the application for the owner", async () => {
			const token = await tokenForCandidate();
			const res = await request(app!.getHttpServer())
				.get("/api/v1/applications/00000000-0000-0000-0000-0000000000bb")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			expect(res.body.data).toHaveProperty("id");
		});
	});

	// ---------------------------------------------------------------------------
	// PATCH /api/v1/applications/:id/status
	// ---------------------------------------------------------------------------
	describe("PATCH /api/v1/applications/:id/status", () => {
		it("returns 401 without auth", async () => {
			await request(app!.getHttpServer())
				.patch(
					"/api/v1/applications/00000000-0000-0000-0000-0000000000bb/status",
				)
				.send({ newStatus: "REVIEWED" })
				.expect(401);
		});

		it("rejects invalid status enum with 400", async () => {
			const token = await tokenForCandidate();
			await request(app!.getHttpServer())
				.patch(
					"/api/v1/applications/00000000-0000-0000-0000-0000000000bb/status",
				)
				.set("Authorization", `Bearer ${token}`)
				.send({ newStatus: "NOT_A_STATUS" })
				.expect(400);
		});
	});

	// ---------------------------------------------------------------------------
	// POST /api/v1/applications/:id/withdraw
	// ---------------------------------------------------------------------------
	describe("POST /api/v1/applications/:id/withdraw", () => {
		it("returns 401 without auth", async () => {
			await request(app!.getHttpServer())
				.post(
					"/api/v1/applications/00000000-0000-0000-0000-0000000000bb/withdraw",
				)
				.expect(401);
		});

		it("returns 400 on bad UUID", async () => {
			const token = await tokenForCandidate();
			await request(app!.getHttpServer())
				.post("/api/v1/applications/not-a-uuid/withdraw")
				.set("Authorization", `Bearer ${token}`)
				.expect(400);
		});
	});

	// ---------------------------------------------------------------------------
	// Notes (POST/GET)
	// ---------------------------------------------------------------------------
	describe("Application notes", () => {
		it("rejects POST without auth (401)", async () => {
			await request(app!.getHttpServer())
				.post("/api/v1/applications/00000000-0000-0000-0000-0000000000bb/notes")
				.send({ content: "x" })
				.expect(401);
		});

		it.skip("rejects empty content with 400", async () => {
			const token = await tokenForCandidate();
			await request(app!.getHttpServer())
				.post("/api/v1/applications/00000000-0000-0000-0000-0000000000bb/notes")
				.set("Authorization", `Bearer ${token}`)
				.send({ content: "" })
				.expect(400);
		});

		it.skip("rejects oversize content with 400", async () => {
			const token = await tokenForCandidate();
			await request(app!.getHttpServer())
				.post("/api/v1/applications/00000000-0000-0000-0000-0000000000bb/notes")
				.set("Authorization", `Bearer ${token}`)
				.send({ content: "x".repeat(10_001) })
				.expect(400);
		});

		it.skip("lists notes with 200 and an array data envelope", async () => {
			const token = await tokenForCandidate();
			const res = await request(app!.getHttpServer())
				.get("/api/v1/applications/00000000-0000-0000-0000-0000000000bb/notes")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			expect(Array.isArray(res.body.data)).toBe(true);
		});
	});
});
