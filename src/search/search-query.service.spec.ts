import type { SearchQueryDto } from "./dto/search.query.dto";
import { SearchQueryService } from "./search-query.service";

describe("SearchQueryService", () => {
	let service: SearchQueryService;
	let mockSearchEngine: any;
	let mockSearchService: any;
	let mockSearchIndex: any;
	let mockFallback: any;
	let mockLogger: any;

	beforeEach(() => {
		mockSearchEngine = {
			search: jest.fn().mockResolvedValue({
				hits: {
					total: { value: 1 },
					hits: [{ _id: "1", _score: 0.9, _source: { title: "Test" } }],
				},
			}),
		};

		mockSearchService = {
			toTsQuery: jest.fn().mockReturnValue("test"),
			buildMultiMatchQuery: jest
				.fn()
				.mockReturnValue({ multi_match: { query: "test" } }),
			buildSearchBody: jest.fn().mockReturnValue({ query: {}, size: 20 }),
		};

		mockSearchIndex = {
			search: jest.fn(),
			indexDocument: jest.fn(),
			deleteByQuery: jest.fn(),
		};

		mockFallback = {
			isCircuitOpen: jest.fn().mockReturnValue(false),
			recordSuccess: jest.fn(),
			recordFailure: jest.fn(),
		};

		mockLogger = {
			setContext: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			info: jest.fn(),
			error: jest.fn(),
		};

		const mockPrisma = {
			$queryRawUnsafe: jest.fn().mockResolvedValue([]),
			searchQueryLog: {
				create: jest.fn().mockResolvedValue({}),
				deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
			},
		};

		service = new SearchQueryService(
			mockSearchEngine,
			mockSearchService,
			mockSearchIndex,
			mockFallback,
			mockPrisma as never,
			mockLogger as never,
		);
	});

	describe("search", () => {
		it("should search with Elasticsearch when circuit is closed", async () => {
			const query: SearchQueryDto = { q: "test", limit: 10 };

			const result = await service.search(query);

			expect(mockSearchEngine.search).toHaveBeenCalled();
			expect(result.meta.engine).toBe("elasticsearch");
			expect(mockFallback.recordSuccess).toHaveBeenCalled();
		});

		it("should fall back to Postgres when ES fails", async () => {
			mockSearchEngine.search.mockRejectedValue(new Error("ES down"));
			const query: SearchQueryDto = { q: "test" };

			const result = await service.search(query);

			expect(result.meta.engine).toBe("postgres");
			expect(mockFallback.recordFailure).toHaveBeenCalled();
		});

		it("should use PG fallback when circuit is open", async () => {
			mockFallback.isCircuitOpen.mockReturnValue(true);
			const query: SearchQueryDto = { q: "test" };

			const result = await service.search(query);

			expect(result.meta.engine).toBe("postgres");
			expect(mockSearchEngine.search).not.toHaveBeenCalled();
		});

		it("should filter by entity types", async () => {
			const query: SearchQueryDto = { q: "test", type: ["jobs"] };

			await service.search(query);

			expect(mockSearchService.buildMultiMatchQuery).toHaveBeenCalledWith(
				"test",
				["jobs"],
				expect.any(Object),
			);
		});

		it("should return search hits from Elasticsearch", async () => {
			mockSearchEngine.search.mockResolvedValue({
				hits: {
					total: { value: 2 },
					hits: [
						{ _id: "1", _score: 0.9, _source: { title: "First" } },
						{ _id: "2", _score: 0.8, _source: { title: "Second" } },
					],
				},
			});
			const query: SearchQueryDto = { q: "test" };

			const result = await service.search(query);

			expect(result.data).toHaveLength(2);
			expect(result.data[0].id).toBe("1");
			expect(result.data[0].type).toBe("profile");
			expect(result.data[0].score).toBeCloseTo(0.9);
			expect(result.meta.total).toBe(2);
		});

		it("should record took milliseconds", async () => {
			const query: SearchQueryDto = { q: "test" };

			const result = await service.search(query);

			expect(result.meta.took).toBeGreaterThanOrEqual(0);
		});

		it("should pass limit to ES search body", async () => {
			const query: SearchQueryDto = { q: "test", limit: 5 };

			await service.search(query);

			expect(mockSearchService.buildSearchBody).toHaveBeenCalledWith(
				expect.any(Object),
				expect.objectContaining({ size: 5 }),
			);
		});

		it("should default type to all entity types when not specified", async () => {
			const query: SearchQueryDto = { q: "test" };

			await service.search(query);

			expect(mockSearchService.buildMultiMatchQuery).toHaveBeenCalledWith(
				"test",
				["profiles", "companies", "jobs", "posts"],
				expect.any(Object),
			);
		});

		it("should set hasNextPage when results match limit", async () => {
			mockSearchEngine.search.mockResolvedValue({
				hits: {
					total: { value: 20 },
					hits: Array.from({ length: 20 }, (_, i) => ({
						_id: String(i),
						_score: 1.0,
						_source: {},
					})),
				},
			});
			const query: SearchQueryDto = { q: "test", limit: 20 };

			const result = await service.search(query);

			expect(result.meta.hasNextPage).toBe(true);
		});
	});

	describe("searchEntity", () => {
		it("should search a specific entity type", async () => {
			const query: SearchQueryDto = { q: "test" };

			const result = await service.searchEntity("jobs", query);

			expect(result.meta.engine).toBe("elasticsearch");
			expect(mockSearchService.buildMultiMatchQuery).toHaveBeenCalledWith(
				"test",
				["jobs"],
				expect.any(Object),
			);
		});
	});
});
