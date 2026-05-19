import { NotificationsController } from "./notifications.controller";

const mockUser = { id: "user-1", email: "test@example.com" };

function createController() {
	const mockService = {
		list: jest.fn(),
		unreadCount: jest.fn(),
		markRead: jest.fn(),
		markAllRead: jest.fn(),
	};
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
	const controller = new NotificationsController(mockService as any);
	return { controller, mockService };
}

describe("NotificationsController", () => {
	it("list — calls service with userId, cursor, limit; returns { data, meta }", async () => {
		const { controller, mockService } = createController();
		const meta = { hasNextPage: false, limit: 20 };
		mockService.list.mockResolvedValue({ items: [], meta });

		const result = await controller.list(mockUser, {
			cursor: undefined,
			limit: 20,
		});

		expect(mockService.list).toHaveBeenCalledWith("user-1", undefined, 20);
		expect(result).toHaveProperty("data");
		expect(result).toHaveProperty("meta");
	});

	it("unreadCount — calls service with userId and returns { count }", async () => {
		const { controller, mockService } = createController();
		mockService.unreadCount.mockResolvedValue(3);

		const result = await controller.unreadCount(mockUser);

		expect(mockService.unreadCount).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({ count: 3 });
	});

	it("markRead — calls service with userId and notificationId, returns dto", async () => {
		const { controller, mockService } = createController();
		const dto = {
			id: "notif-1",
			type: "System",
			title: null,
			body: null,
			actionUrl: null,
			payload: null,
			readAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		};
		mockService.markRead.mockResolvedValue(dto);

		const result = await controller.markRead(mockUser, "notif-1");

		expect(mockService.markRead).toHaveBeenCalledWith("user-1", "notif-1");
		expect(result).toEqual(dto);
	});

	it("markAllRead — calls service with userId and returns { count }", async () => {
		const { controller, mockService } = createController();
		mockService.markAllRead.mockResolvedValue({ count: 10 });

		const result = await controller.markAllRead(mockUser);

		expect(mockService.markAllRead).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({ count: 10 });
	});
});
