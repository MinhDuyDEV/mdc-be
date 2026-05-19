import { JobSearchIndexProcessor } from "./job-search-index.processor";

describe("JobSearchIndexProcessor", () => {
	const stubJob = { id: "job-1", status: "PUBLISHED", deletedAt: null };

	function createProcessor() {
		const mockPrisma = {
			job: {
				findUnique: jest.fn().mockResolvedValue(stubJob),
			},
		};
		const mockLogger = {
			debug: jest.fn(),
			warn: jest.fn(),
		};
		const processor = new JobSearchIndexProcessor(
			mockPrisma as any,
			mockLogger as any,
		);
		return { processor, mockPrisma, mockLogger };
	}

	const METHODS = [
		"processJobCreated",
		"processJobUpdated",
		"processJobPublished",
		"processJobClosed",
		"processJobDeleted",
	] as const;

	describe.each(METHODS)("%s", (method) => {
		it("resolves without throwing and calls logger.debug when job exists", async () => {
			const { processor, mockLogger } = createProcessor();
			await expect(
				processor[method]({ jobId: "job-1" }),
			).resolves.toBeUndefined();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining("ES wiring deferred to Phase 9"),
				"job-1",
			);
		});

		it("warns and returns gracefully when job is not found", async () => {
			const { processor, mockPrisma, mockLogger } = createProcessor();
			mockPrisma.job.findUnique.mockResolvedValue(null);
			await expect(
				processor[method]({ jobId: "missing-id" }),
			).resolves.toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalled();
			expect(mockLogger.debug).not.toHaveBeenCalled();
		});
	});
});
