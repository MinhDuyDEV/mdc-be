import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import type { FeedQueryDto } from "./dto/feed-query.dto";
import { FeedController } from "./feed.controller";
import type { FeedService } from "./feed.service";

interface MockFeedService {
	getHomeFeed: jest.Mock;
	getProfileFeed: jest.Mock;
	getCompanyFeed: jest.Mock;
	getHashtagFeed: jest.Mock;
}

describe("FeedController", () => {
	let controller: FeedController;
	let service: MockFeedService;

	const mockUser: AuthenticatedUser = {
		id: "user-1",
		email: "test@example.com",
	};
	const mockQuery: FeedQueryDto = { limit: 20 };
	const mockResult = { data: [], meta: { hasNextPage: false, limit: 20 } };

	beforeEach(() => {
		service = {
			getHomeFeed: jest.fn().mockResolvedValue(mockResult),
			getProfileFeed: jest.fn().mockResolvedValue(mockResult),
			getCompanyFeed: jest.fn().mockResolvedValue(mockResult),
			getHashtagFeed: jest.fn().mockResolvedValue(mockResult),
		};
		controller = new FeedController(service as unknown as FeedService);
	});

	it("getHomeFeed delegates to service with user id and query", async () => {
		await controller.getHomeFeed(mockUser, mockQuery);
		expect(service.getHomeFeed).toHaveBeenCalledWith("user-1", mockQuery);
	});

	it("getHomeFeed passes undefined when no user", async () => {
		await controller.getHomeFeed(undefined, mockQuery);
		expect(service.getHomeFeed).toHaveBeenCalledWith(undefined, mockQuery);
	});

	it("getProfileFeed delegates to service with viewer id, target userId, and query", async () => {
		await controller.getProfileFeed(mockUser, mockQuery, "profile-user-id");
		expect(service.getProfileFeed).toHaveBeenCalledWith(
			"user-1",
			"profile-user-id",
			mockQuery,
		);
	});

	it("getCompanyFeed delegates to service with companyId and query", async () => {
		await controller.getCompanyFeed(mockUser, mockQuery, "company-id");
		expect(service.getCompanyFeed).toHaveBeenCalledWith(
			"company-id",
			mockQuery,
		);
	});

	it("getHashtagFeed delegates to service with tag and query", async () => {
		await controller.getHashtagFeed(mockUser, mockQuery, "typescript");
		expect(service.getHashtagFeed).toHaveBeenCalledWith(
			"typescript",
			mockQuery,
		);
	});
});
