import { ApplicationEmailProcessor } from "./application-email.processor";

describe("ApplicationEmailProcessor", () => {
	const stubApplication = {
		id: "app-1",
		user: {
			id: "user-1",
			email: "candidate@example.com",
			displayName: "Alice",
		},
		job: {
			id: "job-1",
			title: "Senior Engineer",
			company: { id: "co-1", name: "Acme Corp" },
		},
	};

	function createProcessor() {
		const mockPrisma = {
			application: {
				findUnique: jest.fn().mockResolvedValue(stubApplication),
			},
			emailDelivery: {
				create: jest.fn().mockResolvedValue({ id: "delivery-1" }),
			},
		};
		const mockLogger = {
			debug: jest.fn(),
			warn: jest.fn(),
		};
		const processor = new ApplicationEmailProcessor(
			mockPrisma as any,
			mockLogger as any,
		);
		return { processor, mockPrisma, mockLogger };
	}

	it("warns and skips email creation when application is not found", async () => {
		const { processor, mockPrisma, mockLogger } = createProcessor();
		mockPrisma.application.findUnique.mockResolvedValue(null);

		await processor.processApplicationStatusChanged({
			applicationId: "missing",
			toStatus: "REJECTED",
		});

		expect(mockLogger.warn).toHaveBeenCalled();
		expect(mockPrisma.emailDelivery.create).not.toHaveBeenCalled();
	});

	it("creates a PENDING EmailDelivery row with correct shape for a valid application", async () => {
		const { processor, mockPrisma } = createProcessor();

		await processor.processApplicationStatusChanged({
			applicationId: "app-1",
			toStatus: "INTERVIEW",
		});

		expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					to: "candidate@example.com",
					template: "application-status-changed",
					subject: expect.stringContaining("Senior Engineer"),
				}),
			}),
		);
	});

	it("subject contains the new status (case-insensitive)", async () => {
		const { processor, mockPrisma } = createProcessor();

		await processor.processApplicationStatusChanged({
			applicationId: "app-1",
			toStatus: "OFFERED",
		});

		const createArg = mockPrisma.emailDelivery.create.mock.calls[0][0] as {
			data: { subject: string };
		};
		expect(createArg.data.subject.toLowerCase()).toContain("offered");
	});
});
