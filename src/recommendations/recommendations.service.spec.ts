import type { Redis } from "ioredis";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { RecommendationsRepository } from "./recommendations.repository";
import { RecommendationsService } from "./recommendations.service";

describe("RecommendationsService", () => {
	let service: RecommendationsService;
	let prisma: {
		user: { findMany: jest.Mock };
		job: { findMany: jest.Mock };
		company: { findMany: jest.Mock };
		notificationPreference: { findUnique: jest.Mock };
	};
	let redis: { get: jest.Mock; setex: jest.Mock };
	let repository: {
		findPeopleRecommendations: jest.Mock;
		findJobRecommendations: jest.Mock;
		findCompanyRecommendations: jest.Mock;
	};

	beforeEach(() => {
		prisma = {
			user: { findMany: jest.fn() },
			job: { findMany: jest.fn() },
			company: { findMany: jest.fn() },
			notificationPreference: { findUnique: jest.fn() },
		};

		redis = { get: jest.fn(), setex: jest.fn() };
		repository = {
			findPeopleRecommendations: jest.fn(),
			findJobRecommendations: jest.fn(),
			findCompanyRecommendations: jest.fn(),
		};

		service = new RecommendationsService(
			prisma as unknown as PrismaService,
			repository as unknown as RecommendationsRepository,
			redis as unknown as Redis,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("getPeopleRecommendations", () => {
		it("returns cached result when available", async () => {
			const cached = {
				data: [
					{
						id: "u2",
						displayName: "Bob",
						headline: null,
						location: null,
						profilePictureUrl: null,
						score: 5,
					},
				],
				meta: { hasMore: false, limit: 20 },
			};
			redis.get.mockResolvedValue(JSON.stringify(cached));

			const result = await service.getPeopleRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result).toEqual(cached);
			expect(repository.findPeopleRecommendations).not.toHaveBeenCalled();
		});

		it("returns empty when no recommendations", async () => {
			redis.get.mockResolvedValue(null);
			repository.findPeopleRecommendations.mockResolvedValue([]);

			const result = await service.getPeopleRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result).toEqual({
				data: [],
				meta: { hasMore: false, limit: 20 },
			});
		});

		it("handles Redis unavailable gracefully", async () => {
			redis.get.mockRejectedValue(new Error("Redis down"));
			repository.findPeopleRecommendations.mockResolvedValue([]);

			const result = await service.getPeopleRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result.data).toEqual([]);
		});

		it("enriches scored IDs with user data", async () => {
			redis.get.mockResolvedValue(null);
			repository.findPeopleRecommendations.mockResolvedValue([
				{ id: "user-2", score: 5 },
				{ id: "user-3", score: 3 },
			]);
			prisma.user.findMany.mockResolvedValue([
				{
					id: "user-2",
					displayName: "Alice",
					profile: {
						headline: "Engineer",
						location: "SF",
					},
				},
				{
					id: "user-3",
					displayName: "Bob",
					profile: {
						headline: "Designer",
						location: "NYC",
					},
				},
			]);

			const result = await service.getPeopleRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result.data).toHaveLength(2);
			expect(result.data[0]).toMatchObject({
				id: "user-2",
				displayName: "Alice",
				score: 5,
			});
		});

		it("skips scored IDs that are not found in the database", async () => {
			redis.get.mockResolvedValue(null);
			repository.findPeopleRecommendations.mockResolvedValue([
				{ id: "user-2", score: 5 },
				{ id: "missing-user", score: 3 },
			]);
			prisma.user.findMany.mockResolvedValue([
				{
					id: "user-2",
					displayName: "Alice",
					profile: { headline: null, location: null },
				},
			]);

			const result = await service.getPeopleRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result.data).toHaveLength(1);
			expect(result.data[0].id).toBe("user-2");
		});
	});

	describe("getJobRecommendations", () => {
		it("returns empty when jobRecommendation preference is false", async () => {
			prisma.notificationPreference.findUnique.mockResolvedValue({
				jobRecommendation: false,
			});

			const result = await service.getJobRecommendations("u1", undefined, 20);

			expect(result).toEqual({
				data: [],
				meta: { hasMore: false, limit: 20 },
			});
			expect(repository.findJobRecommendations).not.toHaveBeenCalled();
		});

		it("proceeds when notificationPreference is null (no preference row)", async () => {
			prisma.notificationPreference.findUnique.mockResolvedValue(null);
			redis.get.mockResolvedValue(null);
			repository.findJobRecommendations.mockResolvedValue([]);

			const result = await service.getJobRecommendations("u1", undefined, 20);

			expect(result).toEqual({
				data: [],
				meta: { hasMore: false, limit: 20 },
			});
		});

		it("returns cached result when available", async () => {
			prisma.notificationPreference.findUnique.mockResolvedValue(null);
			const cached = {
				data: [
					{
						id: "job-1",
						title: "Engineer",
						companyName: "Acme",
						location: null,
						employmentType: "FULL_TIME",
						workplaceType: "REMOTE",
						salaryMin: null,
						salaryMax: null,
						salaryCurrency: null,
						publishedAt: null,
						score: 8,
					},
				],
				meta: { hasMore: false, limit: 20 },
			};
			redis.get.mockResolvedValue(JSON.stringify(cached));

			const result = await service.getJobRecommendations("u1", undefined, 20);

			expect(result).toEqual(cached);
		});

		it("enriches scored job IDs with job data", async () => {
			prisma.notificationPreference.findUnique.mockResolvedValue(null);
			redis.get.mockResolvedValue(null);
			repository.findJobRecommendations.mockResolvedValue([
				{ id: "job-1", score: 8 },
			]);
			prisma.job.findMany.mockResolvedValue([
				{
					id: "job-1",
					title: "Engineer",
					location: "Remote",
					employmentType: "FULL_TIME",
					workplaceType: "REMOTE",
					salaryMin: 50000,
					salaryMax: 100000,
					salaryCurrency: "USD",
					publishedAt: new Date("2026-01-01"),
					company: { name: "Acme Corp" },
				},
			]);

			const result = await service.getJobRecommendations("u1", undefined, 20);

			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toMatchObject({
				id: "job-1",
				title: "Engineer",
				companyName: "Acme Corp",
				salaryMin: 50000,
				salaryMax: 100000,
				score: 8,
			});
		});
	});

	describe("getCompanyRecommendations", () => {
		it("returns cached result when available", async () => {
			const cached = {
				data: [
					{
						id: "company-1",
						name: "Acme",
						industry: null,
						followerCount: 10,
						verified: false,
						logoUrl: null,
						score: 4,
					},
				],
				meta: { hasMore: false, limit: 20 },
			};
			redis.get.mockResolvedValue(JSON.stringify(cached));

			const result = await service.getCompanyRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result).toEqual(cached);
		});

		it("returns empty when no recommendations", async () => {
			redis.get.mockResolvedValue(null);
			repository.findCompanyRecommendations.mockResolvedValue([]);

			const result = await service.getCompanyRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result).toEqual({
				data: [],
				meta: { hasMore: false, limit: 20 },
			});
		});

		it("enriches scored company IDs with company data", async () => {
			redis.get.mockResolvedValue(null);
			repository.findCompanyRecommendations.mockResolvedValue([
				{ id: "company-1", score: 4 },
			]);
			prisma.company.findMany.mockResolvedValue([
				{
					id: "company-1",
					name: "Acme Corp",
					industry: "Technology",
					followerCount: 100,
					verified: true,
				},
			]);

			const result = await service.getCompanyRecommendations(
				"u1",
				undefined,
				20,
			);

			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toMatchObject({
				id: "company-1",
				name: "Acme Corp",
				industry: "Technology",
				verified: true,
				score: 4,
			});
		});
	});
});
