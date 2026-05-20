import type { INestApplication, Type } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { ConnectionStatus, FollowStatus } from "@prisma/client";
import request from "supertest";
import type { App } from "supertest/types";

describe("Connections (e2e)", () => {
	let app: INestApplication<App> | undefined;
	let originalEnv: NodeJS.ProcessEnv;
	let PrismaService: Type<unknown>;

	beforeEach(async () => {
		originalEnv = { ...process.env };
		process.env.NODE_ENV = "test";
		process.env.PORT = "3000";
		process.env.CORS_ORIGINS = "http://localhost:3000";
		process.env.BODY_JSON_LIMIT = "1mb";
		process.env.BODY_URLENCODED_LIMIT = "1mb";
		if (!process.env.DATABASE_URL) {
			process.env.DATABASE_URL =
				"postgresql://postgres:postgres@localhost:5432/mdc_test?schema=public";
		}
		if (!process.env.REDIS_URL) {
			process.env.REDIS_URL = "redis://localhost:6379";
		}
		process.env.S3_ENDPOINT = "http://localhost:9000";
		process.env.S3_REGION = "us-east-1";
		process.env.S3_ACCESS_KEY_ID = "minioadmin";
		process.env.S3_SECRET_ACCESS_KEY = "minioadmin";
		process.env.S3_BUCKET = "mdc-test";
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
		const { PrismaService: PS } = jest.requireActual<{
			PrismaService: Type<unknown>;
		}>("./../src/infra/prisma");
		PrismaService = PS;
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
		const { EmailProcessor } = jest.requireActual<{
			EmailProcessor: Type<unknown>;
		}>("./../src/email/email.processor");
		const { OutboxService } = jest.requireActual<{
			OutboxService: Type<unknown>;
		}>("./../src/outbox/outbox.service");

		const userA = {
			id: "aaaa0000-0000-0000-0000-000000000001",
			email: "usera@example.com",
			passwordHash: null,
			displayName: "User A",
			emailVerifiedAt: new Date(),
			status: "ACTIVE",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const userB = {
			id: "bbbb0000-0000-0000-0000-000000000002",
			email: "userb@example.com",
			passwordHash: null,
			displayName: "User B",
			emailVerifiedAt: new Date(),
			status: "ACTIVE",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const userC = {
			id: "cccc0000-0000-0000-0000-000000000003",
			email: "userc@example.com",
			passwordHash: null,
			displayName: "User C",
			emailVerifiedAt: new Date(),
			status: "ACTIVE",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// Accepted connection: User A ==requester==> User B
		const mockConnection = {
			id: "11110000-0000-0000-0000-000000000001",
			requesterId: userA.id,
			addresseeId: userB.id,
			status: ConnectionStatus.ACCEPTED,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			requester: {
				id: userA.id,
				email: userA.email,
				profile: {
					firstName: "User",
					lastName: "A",
					headline: "Engineer",
				},
			},
			addressee: {
				id: userB.id,
				email: userB.email,
				profile: {
					firstName: "User",
					lastName: "B",
					headline: "Designer",
				},
			},
		};

		// Pending connection: User A ==requester==> User C
		const mockPendingConnection = {
			id: "11110000-0000-0000-0000-000000000002",
			requesterId: userA.id,
			addresseeId: userC.id,
			status: ConnectionStatus.PENDING,
			createdAt: new Date("2024-01-02"),
			updatedAt: new Date("2024-01-02"),
			requester: {
				id: userA.id,
				email: userA.email,
				profile: { firstName: "User", lastName: "A", headline: "Engineer" },
			},
			addressee: {
				id: userC.id,
				email: userC.email,
				profile: { firstName: "User", lastName: "C", headline: "PM" },
			},
		};

		// Active follow: User A follows User B
		const mockFollow = {
			id: "11110000-0000-0000-0000-000000000011",
			followerId: userA.id,
			followeeId: userB.id,
			status: FollowStatus.ACTIVE,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
		};

		// Block: User A blocked User B
		const mockBlock = {
			id: "11110000-0000-0000-0000-000000000021",
			blockerId: userA.id,
			blockedId: userB.id,
			createdAt: new Date("2024-01-01"),
		};

		const transactionMock: Record<string, unknown> = {
			connection: {
				create: jest.fn().mockResolvedValue(mockConnection),
				update: jest.fn().mockResolvedValue(mockConnection),
				findUnique: jest.fn().mockResolvedValue(mockConnection),
				findMany: jest.fn().mockResolvedValue([mockConnection]),
				findFirst: jest.fn().mockReturnValue(null),
				updateMany: jest.fn().mockResolvedValue({ count: 1 }),
				count: jest.fn().mockResolvedValue(1),
			},
			follow: {
				create: jest.fn().mockResolvedValue(mockFollow),
				update: jest.fn().mockResolvedValue(mockFollow),
				findFirst: jest.fn().mockReturnValue(null),
				updateMany: jest.fn().mockResolvedValue({ count: 1 }),
				count: jest.fn().mockResolvedValue(0),
			},
			block: {
				create: jest.fn().mockResolvedValue(mockBlock),
				findFirst: jest.fn().mockReturnValue(null),
				findUnique: jest.fn().mockResolvedValue(null),
				delete: jest.fn().mockResolvedValue(mockBlock),
				count: jest.fn().mockResolvedValue(0),
			},
			outboxEvent: { create: jest.fn() },
			auditLog: { create: jest.fn() },
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
				user: {
					findUnique: jest.fn().mockResolvedValue(userA),
				},
				connection: {
					create: jest.fn().mockResolvedValue(mockConnection),
					update: jest.fn().mockResolvedValue(mockConnection),
					findUnique: jest.fn().mockImplementation((args: any) => {
						if (args?.where?.id === "00000000-0000-0000-0000-ffffffffffff")
							return null;
						if (args?.where?.id === mockPendingConnection.id)
							return mockPendingConnection;
						return mockConnection;
					}),
					findMany: jest.fn().mockResolvedValue([mockConnection]),
					findFirst: jest.fn().mockReturnValue(null),
					updateMany: jest.fn().mockResolvedValue({ count: 1 }),
					count: jest.fn().mockResolvedValue(1),
				},
				follow: {
					create: jest.fn().mockResolvedValue(mockFollow),
					update: jest.fn().mockResolvedValue(mockFollow),
					findFirst: jest.fn().mockImplementation((args: any) => {
						if (
							args?.where?.followerId === userA.id &&
							args?.where?.followeeId === userB.id
						) {
							return mockFollow;
						}
						return null;
					}),
					updateMany: jest.fn().mockResolvedValue({ count: 1 }),
					count: jest.fn().mockResolvedValue(0),
				},
				block: {
					create: jest.fn().mockResolvedValue(mockBlock),
					findFirst: jest.fn().mockReturnValue(null),
					findUnique: jest.fn().mockResolvedValue(null),
					delete: jest.fn().mockResolvedValue(mockBlock),
					count: jest.fn().mockResolvedValue(0),
				},
				outboxEvent: {
					create: jest.fn(),
				},
				auditLog: {
					create: jest.fn(),
				},
				application: {
					findMany: jest.fn().mockResolvedValue([]),
					findUnique: jest.fn(),
					findFirst: jest.fn(),
					create: jest.fn(),
					update: jest.fn(),
					count: jest.fn().mockResolvedValue(0),
				},
				job: {
					findUnique: jest.fn(),
					findMany: jest.fn().mockResolvedValue([]),
					findFirst: jest.fn(),
					create: jest.fn(),
					update: jest.fn(),
				},
				savedCandidate: {
					findUnique: jest.fn(),
					findMany: jest.fn().mockResolvedValue([]),
					findFirst: jest.fn(),
					create: jest.fn(),
					update: jest.fn(),
					updateMany: jest.fn(),
				},
				talentPool: {
					findUnique: jest.fn(),
					findMany: jest.fn().mockResolvedValue([]),
					findFirst: jest.fn(),
					create: jest.fn(),
					update: jest.fn(),
					count: jest.fn().mockResolvedValue(0),
				},
				talentPoolEntry: {
					findUnique: jest.fn(),
					findMany: jest.fn().mockResolvedValue([]),
					findFirst: jest.fn(),
					create: jest.fn(),
					update: jest.fn(),
				},
				idempotencyKey: {
					create: jest.fn(),
					findMany: jest.fn().mockResolvedValue([]),
					deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
				},
				notification: {
					create: jest.fn(),
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
				search: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
				deleteByQuery: jest.fn(),
			})
			.overrideProvider(SearchEngineHealthService)
			.useValue({ ping: jest.fn().mockResolvedValue(undefined) })
			.overrideProvider(MailerService)
			.useValue({
				sendMail: jest.fn(),
				verifyConnection: jest.fn(),
			})
			.overrideProvider(MailerHealthService)
			.useValue({ ping: jest.fn().mockResolvedValue(undefined) })
			.overrideProvider(SearchIndexService)
			.useValue({
				indexCompany: jest.fn(),
				indexJob: jest.fn(),
				removeCompany: jest.fn(),
				removeJob: jest.fn(),
			})
			.overrideProvider(SearchService)
			.useValue({
				search: jest.fn().mockResolvedValue({
					data: [],
					meta: { total: 0 },
				}),
				searchCompanies: jest.fn().mockResolvedValue({
					data: [],
					meta: { total: 0 },
				}),
				searchJobs: jest.fn().mockResolvedValue({
					data: [],
					meta: { total: 0 },
				}),
				searchProfiles: jest.fn().mockResolvedValue({
					data: [],
					meta: { total: 0 },
				}),
			})
			.overrideProvider(OutboxProcessor)
			.useValue({
				processOutbox: jest.fn(),
			})
			.overrideProvider(DeadLetterService)
			.useValue({
				moveToDeadLetter: jest.fn(),
			})
			.overrideProvider(IdempotencyService)
			.useValue({
				claim: jest.fn().mockResolvedValue({}),
			})
			.overrideProvider(EmailProcessor)
			.useValue({
				processApplicationConfirmation: jest.fn(),
				processApplicationStatusChange: jest.fn(),
				processSavedCandidateNotification: jest.fn(),
			})
			.overrideProvider(OutboxService)
			.useValue({
				emit: jest.fn(),
			})
			.compile();

		app = moduleFixture.createNestApplication({ bodyParser: false });
		configureApp(app);
		await app.init();
	});

	afterEach(async () => {
		if (app) {
			await app.close();
		}
		process.env = originalEnv;
		jest.clearAllMocks();
	});

	const generateToken = async () => {
		const jwtService = app!.get(JwtService);
		return jwtService.sign({ sub: "aaaa0000-0000-0000-0000-000000000001" });
	};

	// Helper: get the Prisma mock from the DI container (with a type-safe wrapper)
	function mockPrisma(): Record<string, jest.Mock | Record<string, jest.Mock>> {
		return app!.get(PrismaService) as Record<
			string,
			jest.Mock | Record<string, jest.Mock>
		>;
	}

	// =========================================================================
	// POST /api/v1/connections — Send a connection request
	// =========================================================================

	describe("POST /api/v1/connections", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.post("/api/v1/connections")
				.send({ toUserId: "bbbb0000-0000-0000-0000-000000000002" })
				.expect(401);
		});

		it("should return 201 with valid body", async () => {
			const token = await generateToken();
			const response = await request(app!.getHttpServer())
				.post("/api/v1/connections")
				.set("Authorization", `Bearer ${token}`)
				.send({ toUserId: "bbbb0000-0000-0000-0000-000000000002" })
				.expect(201);

			expect(response.body).toHaveProperty("data");
		});
	});

	// =========================================================================
	// GET /api/v1/connections — List accepted connections
	// =========================================================================

	describe("GET /api/v1/connections", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.get("/api/v1/connections")
				.expect(401);
		});

		it("should return 200 with paginated results", async () => {
			const token = await generateToken();
			const response = await request(app!.getHttpServer())
				.get("/api/v1/connections")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("meta");
		});
	});

	// =========================================================================
	// GET /api/v1/connections/pending — List pending requests
	// =========================================================================

	describe("GET /api/v1/connections/pending", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.get("/api/v1/connections/pending")
				.expect(401);
		});

		it("should return 200 with paginated results", async () => {
			const token = await generateToken();
			const response = await request(app!.getHttpServer())
				.get("/api/v1/connections/pending")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("meta");
		});
	});

	// =========================================================================
	// PATCH /api/v1/connections/:id/accept — Accept a connection request
	// =========================================================================

	describe("PATCH /api/v1/connections/:id/accept", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.patch(
					"/api/v1/connections/00000000-0000-0000-0000-000000000001/accept",
				)
				.expect(401);
		});
	});

	// =========================================================================
	// PATCH /api/v1/connections/:id/decline — Decline a connection request
	// =========================================================================

	describe("PATCH /api/v1/connections/:id/decline", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.patch(
					"/api/v1/connections/00000000-0000-0000-0000-000000000001/decline",
				)
				.expect(401);
		});
	});

	// =========================================================================
	// DELETE /api/v1/connections/:id — Remove a connection
	// =========================================================================

	describe("DELETE /api/v1/connections/:id", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.delete("/api/v1/connections/00000000-0000-0000-0000-000000000001")
				.expect(401);
		});
	});

	// =========================================================================
	// POST /api/v1/users/:id/follow — Follow a user
	// =========================================================================

	describe("POST /api/v1/users/:id/follow", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.post("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/follow")
				.expect(401);
		});

		it("should return 201 when following a user", async () => {
			const token = await generateToken();
			const response = await request(app!.getHttpServer())
				.post("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/follow")
				.set("Authorization", `Bearer ${token}`)
				.expect(201);

			expect(response.body).toHaveProperty("data");
		});
	});

	// =========================================================================
	// DELETE /api/v1/users/:id/follow — Unfollow a user
	// =========================================================================

	describe("DELETE /api/v1/users/:id/follow", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.delete("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/follow")
				.expect(401);
		});

		it("should return 204 when unfollowing", async () => {
			const token = await generateToken();
			await request(app!.getHttpServer())
				.delete("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/follow")
				.set("Authorization", `Bearer ${token}`)
				.expect(204);
		});
	});

	// =========================================================================
	// POST /api/v1/users/:id/block — Block a user
	// =========================================================================

	describe("POST /api/v1/users/:id/block", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.post("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/block")
				.expect(401);
		});

		it("should return 201 when blocking a user", async () => {
			const token = await generateToken();
			const response = await request(app!.getHttpServer())
				.post("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/block")
				.set("Authorization", `Bearer ${token}`)
				.expect(201);

			expect(response.body).toHaveProperty("data");
		});
	});

	// =========================================================================
	// DELETE /api/v1/users/:id/block — Unblock a user
	// =========================================================================

	describe("DELETE /api/v1/users/:id/block", () => {
		it("should return 401 without auth token", async () => {
			await request(app!.getHttpServer())
				.delete("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/block")
				.expect(401);
		});

		it("should return 204 when unblocking", async () => {
			const prisma = mockPrisma();
			(
				prisma.block as Record<string, jest.Mock>
			).findFirst.mockResolvedValueOnce({
				id: "11110000-0000-0000-0000-000000000021",
				blockerId: "aaaa0000-0000-0000-0000-000000000001",
				blockedId: "bbbb0000-0000-0000-0000-000000000002",
				createdAt: new Date(),
			});

			const token = await generateToken();
			await request(app!.getHttpServer())
				.delete("/api/v1/users/bbbb0000-0000-0000-0000-000000000002/block")
				.set("Authorization", `Bearer ${token}`)
				.expect(204);
		});
	});

	// =========================================================================
	// Block prevents connection request
	// =========================================================================

	describe("Block prevents new connection request", () => {
		it("should return 400 when blocked user tries to connect", async () => {
			const prisma = mockPrisma();
			(
				prisma.block as Record<string, jest.Mock>
			).findFirst.mockResolvedValueOnce({
				id: "11110000-0000-0000-0000-000000000099",
				blockerId: "bbbb0000-0000-0000-0000-000000000002",
				blockedId: "aaaa0000-0000-0000-0000-000000000001",
				createdAt: new Date(),
			});

			const token = await generateToken();
			await request(app!.getHttpServer())
				.post("/api/v1/connections")
				.set("Authorization", `Bearer ${token}`)
				.send({ toUserId: "bbbb0000-0000-0000-0000-000000000002" })
				.expect(400);
		});
	});
});
