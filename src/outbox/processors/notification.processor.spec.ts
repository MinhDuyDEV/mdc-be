import { Logger } from "@nestjs/common";
import { NotificationProcessor } from "./notification.processor";

interface MockPrisma {
	application: { findUnique: jest.Mock };
	companyMember: { findMany: jest.Mock };
	recruiterSeat: { findMany: jest.Mock; findFirst: jest.Mock };
	notification: { create: jest.Mock; findFirst: jest.Mock };
}

interface MockIdempotency {
	claim: jest.Mock;
}

interface MockLogger {
	debug: jest.Mock;
	warn: jest.Mock;
	error: jest.Mock;
	info: jest.Mock;
}

function createProcessor() {
	const prisma: MockPrisma = {
		application: { findUnique: jest.fn() },
		companyMember: { findMany: jest.fn().mockResolvedValue([]) },
		recruiterSeat: {
			findMany: jest.fn().mockResolvedValue([]),
			findFirst: jest.fn(),
		},
		notification: {
			create: jest.fn().mockResolvedValue({
				id: "notif-1",
				createdAt: new Date(),
			}),
			findFirst: jest.fn().mockResolvedValue(null),
		},
	};
	const idempotency: MockIdempotency = {
		claim: jest.fn().mockResolvedValue({ id: "idem-1" }),
	};
	const logger: MockLogger = {
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
	};
	const realtimeGateway = {
		pushNotification: jest.fn(),
	};
	const processor = new NotificationProcessor(
		prisma as never,
		idempotency as never,
		realtimeGateway as never,
	);
	return { processor, prisma, idempotency, logger, realtimeGateway };
}

describe("NotificationProcessor", () => {
	let warnSpy: jest.SpyInstance;
	let debugSpy: jest.SpyInstance;

	beforeEach(() => {
		warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
		debugSpy = jest.spyOn(Logger.prototype, "debug").mockImplementation();
	});

	afterEach(() => {
		warnSpy.mockRestore();
		debugSpy.mockRestore();
	});
	describe("processApplicationSubmitted", () => {
		it("inserts notifications for OWNER + ADMIN + active seat holders", async () => {
			const { processor, prisma } = createProcessor();
			prisma.application.findUnique.mockResolvedValue({ id: "app-1" });
			prisma.companyMember.findMany.mockResolvedValue([
				{ userId: "owner-1" },
				{ userId: "admin-1" },
			]);
			prisma.recruiterSeat.findMany.mockResolvedValue([
				{ userId: "seat-user-1" },
				{ userId: "seat-user-2" },
			]);

			await processor.processApplicationSubmitted({
				applicationId: "app-1",
				jobId: "job-1",
				companyId: "company-1",
				candidateUserId: "candidate-1",
			});

			expect(prisma.notification.create).toHaveBeenCalledTimes(4);
		});

		it("dedupes when a user is both ADMIN and seat holder", async () => {
			const { processor, prisma } = createProcessor();
			prisma.application.findUnique.mockResolvedValue({ id: "app-1" });
			prisma.companyMember.findMany.mockResolvedValue([{ userId: "shared-1" }]);
			prisma.recruiterSeat.findMany.mockResolvedValue([{ userId: "shared-1" }]);

			await processor.processApplicationSubmitted({
				applicationId: "app-1",
				jobId: "job-1",
				companyId: "company-1",
				candidateUserId: "candidate-1",
			});

			expect(prisma.notification.create).toHaveBeenCalledTimes(1);
		});

		it("skips on replay when notification already exists", async () => {
			const { processor, prisma } = createProcessor();
			prisma.application.findUnique.mockResolvedValue({ id: "app-1" });
			prisma.companyMember.findMany.mockResolvedValue([{ userId: "owner-1" }]);
			prisma.notification.findFirst.mockResolvedValue({ id: "notif-exists" });

			await processor.processApplicationSubmitted({
				applicationId: "app-1",
				jobId: "job-1",
				companyId: "company-1",
				candidateUserId: "candidate-1",
			});

			expect(prisma.notification.create).not.toHaveBeenCalled();
		});

		it("is a graceful no-op when application not found", async () => {
			const { processor, prisma } = createProcessor();
			prisma.application.findUnique.mockResolvedValue(null);

			await processor.processApplicationSubmitted({
				applicationId: "missing",
				jobId: "job-1",
				companyId: "company-1",
				candidateUserId: "candidate-1",
			});

			expect(prisma.notification.create).not.toHaveBeenCalled();
			expect(warnSpy).toHaveBeenCalled();
		});
	});

	describe("processApplicationStatusChanged", () => {
		it("notifies only the candidate for non-WITHDRAWN transitions", async () => {
			const { processor, prisma } = createProcessor();
			prisma.application.findUnique.mockResolvedValue({
				id: "app-1",
				userId: "candidate-1",
			});

			await processor.processApplicationStatusChanged({
				applicationId: "app-1",
				toStatus: "REVIEWED",
				companyId: "company-1",
				candidateUserId: "candidate-1",
			});

			expect(prisma.notification.create).toHaveBeenCalledTimes(1);
			expect(prisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ userId: "candidate-1" }),
				}),
			);
		});

		it("notifies candidate + recruiter set on WITHDRAWN", async () => {
			const { processor, prisma } = createProcessor();
			prisma.application.findUnique.mockResolvedValue({
				id: "app-1",
				userId: "candidate-1",
			});
			prisma.companyMember.findMany.mockResolvedValue([{ userId: "admin-1" }]);
			prisma.recruiterSeat.findMany.mockResolvedValue([
				{ userId: "recruiter-1" },
			]);

			await processor.processApplicationStatusChanged({
				applicationId: "app-1",
				toStatus: "WITHDRAWN",
				companyId: "company-1",
				candidateUserId: "candidate-1",
			});

			expect(prisma.notification.create).toHaveBeenCalledTimes(3);
		});
	});

	describe("processApplicationNoteAdded", () => {
		it("excludes the note author from recipients", async () => {
			const { processor, prisma } = createProcessor();
			prisma.application.findUnique.mockResolvedValue({ id: "app-1" });
			prisma.companyMember.findMany.mockResolvedValue([
				{ userId: "admin-1" },
				{ userId: "author-1" },
			]);

			await processor.processApplicationNoteAdded({
				applicationId: "app-1",
				noteId: "note-1",
				authorUserId: "author-1",
				companyId: "company-1",
			});

			expect(prisma.notification.create).toHaveBeenCalledTimes(1);
			expect(prisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ userId: "admin-1" }),
				}),
			);
		});
	});

	describe("processRecruiterSeatAllocated", () => {
		it("inserts one notification for the recruiter", async () => {
			const { processor, prisma } = createProcessor();
			prisma.recruiterSeat.findFirst.mockResolvedValue({ id: "seat-1" });

			await processor.processRecruiterSeatAllocated({
				recruiterUserId: "recruiter-1",
				companyId: "company-1",
			});

			expect(prisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						userId: "recruiter-1",
						type: "RecruiterSeatAllocated",
					}),
				}),
			);
		});

		it("is a no-op when seat is not found", async () => {
			const { processor, prisma } = createProcessor();
			prisma.recruiterSeat.findFirst.mockResolvedValue(null);

			await processor.processRecruiterSeatAllocated({
				recruiterUserId: "recruiter-1",
				companyId: "company-1",
			});

			expect(prisma.notification.create).not.toHaveBeenCalled();
			expect(warnSpy).toHaveBeenCalled();
		});
	});

	describe("idempotency key format", () => {
		it("builds key as recipientUserId:eventType:aggregateId", async () => {
			const { processor, prisma, idempotency } = createProcessor();
			prisma.recruiterSeat.findFirst.mockResolvedValue({ id: "seat-42" });

			await processor.processRecruiterSeatAllocated({
				recruiterUserId: "user-99",
				companyId: "company-1",
			});

			expect(idempotency.claim).toHaveBeenCalledWith(
				"Notification",
				"user-99:RecruiterSeatAllocated:seat-42",
			);
		});
	});
});
