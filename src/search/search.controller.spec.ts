import { SearchController } from "./search.controller";

describe("SearchController", () => {
	let controller: SearchController;
	let mockSearchQuery: any;
	let mockSearchIndex: any;

	beforeEach(() => {
		mockSearchQuery = {
			search: jest.fn().mockResolvedValue({
				data: [],
				meta: {
					total: 0,
					hasNextPage: false,
					took: 10,
					engine: "elasticsearch",
				},
			}),
		};

		mockSearchIndex = {
			reindexEntity: jest.fn().mockResolvedValue("reindex-jobs-123"),
		};

		controller = new SearchController(mockSearchQuery, mockSearchIndex);
	});

	it("should call searchQuery.search for unified search", async () => {
		const query = { q: "engineer", limit: 20 } as any;
		const req = { user: { id: "user-1" } };

		await controller.search(query, req);
		expect(mockSearchQuery.search).toHaveBeenCalledWith(query, "user-1");
	});

	it("should pass userId undefined when no user", async () => {
		const query = { q: "test" } as any;
		const req = {};

		await controller.search(query, req);
		expect(mockSearchQuery.search).toHaveBeenCalledWith(query, undefined);
	});

	it("should search with type: [jobs]", async () => {
		const query = { q: "engineer", limit: 20 } as any;
		const req = { user: { id: "user-1" } };

		await controller.searchJobs(query, req);
		expect(mockSearchQuery.search).toHaveBeenCalledWith(
			{ ...query, type: ["jobs"] },
			"user-1",
		);
	});

	it("should search with type: [profiles]", async () => {
		const query = { q: "react developer" } as any;
		const req = { user: { id: "user-1" } };

		await controller.searchUsers(query, req);
		expect(mockSearchQuery.search).toHaveBeenCalledWith(
			{ ...query, type: ["profiles"] },
			"user-1",
		);
	});

	it("should search with type: [companies]", async () => {
		const query = { q: "tech startup" } as any;
		const req = { user: { id: "user-1" } };

		await controller.searchCompanies(query, req);
		expect(mockSearchQuery.search).toHaveBeenCalledWith(
			{ ...query, type: ["companies"] },
			"user-1",
		);
	});

	it("should search with type: [posts]", async () => {
		const query = { q: "machine learning" } as any;
		const req = { user: { id: "user-1" } };

		await controller.searchPosts(query, req);
		expect(mockSearchQuery.search).toHaveBeenCalledWith(
			{ ...query, type: ["posts"] },
			"user-1",
		);
	});

	it("should call searchIndex.reindexEntity", async () => {
		const req = { user: { id: "admin-1" } };

		const result = await controller.reindex("jobs", req);
		expect(mockSearchIndex.reindexEntity).toHaveBeenCalledWith(
			"jobs",
			"admin-1",
		);
		expect(result).toEqual({
			message: "Reindex started for jobs",
			runId: "reindex-jobs-123",
		});
	});
});
