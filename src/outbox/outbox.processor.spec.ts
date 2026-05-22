import { OutboxProcessor } from "./outbox.processor";

/* eslint-disable @typescript-eslint/no-unsafe-argument */

describe("OutboxProcessor", () => {
	function createProcessor() {
		const mockPrisma = {
			$transaction: jest.fn(),
			$executeRaw: jest.fn().mockResolvedValue(0),
			outboxEvent: {
				findMany: jest.fn(),
				findUnique: jest.fn(),
				update: jest.fn(),
			},
		};
		const mockConfig = {
			get: jest.fn((key: string) => {
				const defaults: Record<string, number> = {
					outboxBatchSize: 20,
					outboxMaxRetries: 5,
					outboxBaseBackoffMs: 1000,
					outboxMaxBackoffMs: 60000,
					outboxLeaseTimeoutMs: 60000,
				};
				return defaults[key];
			}),
		};
		const mockDeadLetter = {
			moveToDeadLetter: jest.fn().mockResolvedValue(undefined),
		};
		const mockCompanySearchIndex = {
			processCompanyCreated: jest.fn().mockResolvedValue(undefined),
			processCompanyUpdated: jest.fn().mockResolvedValue(undefined),
		};
		const mockJobSearchIndex = {
			processJobCreated: jest.fn().mockResolvedValue(undefined),
			processJobUpdated: jest.fn().mockResolvedValue(undefined),
			processJobPublished: jest.fn().mockResolvedValue(undefined),
			processJobClosed: jest.fn().mockResolvedValue(undefined),
			processJobDeleted: jest.fn().mockResolvedValue(undefined),
		};
		const mockApplicationEmail = {
			processApplicationStatusChanged: jest.fn().mockResolvedValue(undefined),
		};
		const mockNotification = {
			processApplicationSubmitted: jest.fn().mockResolvedValue(undefined),
			processApplicationStatusChanged: jest.fn().mockResolvedValue(undefined),
			processApplicationNoteAdded: jest.fn().mockResolvedValue(undefined),
			processRecruiterSeatAllocated: jest.fn().mockResolvedValue(undefined),
		};
		const mockPostInteraction = {
			processPostCreated: jest.fn(),
			processCommentAdded: jest.fn(),
			processReactionAdded: jest.fn(),
			processMentionCreated: jest.fn(),
		};

		const mockPostSearchIndex = {
			processPostCreated: jest.fn().mockResolvedValue(undefined),
			processPostUpdated: jest.fn().mockResolvedValue(undefined),
			processPostDeleted: jest.fn().mockResolvedValue(undefined),
		};

		const mockMessagingProcessor = {
			processMessageSent: jest.fn(),
		};

		const mockProfileSearchIndex = {
			processProfileUpdated: jest.fn(),
		};

		const mockBillingProcessor = {
			processPaymentProviderEvent: jest.fn().mockResolvedValue(undefined),
		};
		const mockSubscriptionProcessor = {
			createFreeSubscription: jest.fn().mockResolvedValue(undefined),
		};
		const mockLogger = {
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		};

		const processor = new OutboxProcessor(
			mockPrisma as any,
			mockConfig as any,
			mockDeadLetter as any,
			mockCompanySearchIndex as any,
			mockJobSearchIndex as any,
			mockApplicationEmail as any,
			mockNotification as any,
			mockMessagingProcessor as any,
			mockPostInteraction as any,
			mockPostSearchIndex as any,
			mockProfileSearchIndex as any,
			mockBillingProcessor as any,
			mockSubscriptionProcessor as any,
			mockLogger as any,
		);
		return {
			processor,
			mockPrisma,
			mockConfig,
			mockDeadLetter,
			mockCompanySearchIndex,
			mockJobSearchIndex,
			mockApplicationEmail,
			mockNotification,
			mockLogger,
		};
	}

	describe("claimEvents", () => {
		it("should claim events atomically via transaction", async () => {
			const { processor, mockPrisma } = createProcessor();

			const mockEvents = [
				{ id: "event-1", eventType: "test.event", payload: { foo: "bar" } },
			];

			mockPrisma.$transaction.mockImplementation(async (fn: any) => {
				return fn({
					$queryRaw: jest.fn().mockResolvedValue([{ id: "event-1" }]),
					$executeRaw: jest.fn().mockResolvedValue(1),
					outboxEvent: {
						findMany: jest.fn().mockResolvedValue(mockEvents),
					},
				});
			});

			const claimed = await processor.claimEvents();
			expect(claimed).toHaveLength(1);
			expect(claimed[0].id).toBe("event-1");
			expect(mockPrisma.$transaction).toHaveBeenCalled();
		});

		it("should return empty array when no pending events", async () => {
			const { processor, mockPrisma } = createProcessor();

			mockPrisma.$transaction.mockImplementation(async (fn: any) => {
				return fn({
					$queryRaw: jest.fn().mockResolvedValue([]),
					$executeRaw: jest.fn(),
					outboxEvent: { findMany: jest.fn() },
				});
			});

			const claimed = await processor.claimEvents();
			expect(claimed).toHaveLength(0);
		});
	});

	describe("processOutbox", () => {
		it("should mark claimed events as PROCESSED on success", async () => {
			const { processor, mockPrisma } = createProcessor();

			// stale lock recovery (no stale locks)
			mockPrisma.$executeRaw.mockResolvedValue(0);

			// claimEvents: return one event
			mockPrisma.$transaction.mockImplementation(async (fn: any) => {
				return fn({
					$queryRaw: jest.fn().mockResolvedValue([{ id: "event-1" }]),
					$executeRaw: jest.fn().mockResolvedValue(1),
					outboxEvent: {
						findMany: jest.fn().mockResolvedValue([
							{
								id: "event-1",
								eventType: "test.event",
								payload: { data: 1 },
								attempts: 1,
							},
						]),
					},
				});
			});

			// markProcessed
			mockPrisma.outboxEvent.update.mockResolvedValue({});

			await processor.processOutbox();

			const updateCalls = mockPrisma.outboxEvent.update.mock.calls;
			expect(updateCalls.length).toBeGreaterThanOrEqual(1);
			const markProcessedCall = updateCalls.find(
				(call: any) => call[0].data?.status === "PROCESSED",
			);
			expect(markProcessedCall).toBeDefined();
			expect(markProcessedCall[0].where.id).toBe("event-1");
		});

		it("should move exhausted events to dead-letter", async () => {
			const { processor, mockPrisma, mockDeadLetter } = createProcessor();

			mockPrisma.$executeRaw.mockResolvedValue(0);

			mockPrisma.$transaction.mockImplementation(async (fn: any) => {
				return fn({
					$queryRaw: jest.fn().mockResolvedValue([{ id: "event-2" }]),
					$executeRaw: jest.fn().mockResolvedValue(1),
					outboxEvent: {
						findMany: jest.fn().mockResolvedValue([
							{
								id: "event-2",
								eventType: "test.event",
								payload: { data: 1 },
								attempts: 6, // > maxRetries (5)
							},
						]),
					},
				});
			});

			// markProcessed throws → triggers catch path
			mockPrisma.outboxEvent.update.mockRejectedValue(
				new Error("Handler failed"),
			);
			// getAttempts returns 6 (> maxRetries)
			mockPrisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 6 });

			await processor.processOutbox();

			expect(mockDeadLetter.moveToDeadLetter).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-2",
					eventType: "test.event",
				}),
				expect.any(Error),
			);
		});

		it("should requeue events with backoff on transient failure", async () => {
			const { processor, mockPrisma } = createProcessor();

			mockPrisma.$executeRaw.mockResolvedValue(0);

			mockPrisma.$transaction.mockImplementation(async (fn: any) => {
				return fn({
					$queryRaw: jest.fn().mockResolvedValue([{ id: "event-3" }]),
					$executeRaw: jest.fn().mockResolvedValue(1),
					outboxEvent: {
						findMany: jest.fn().mockResolvedValue([
							{
								id: "event-3",
								eventType: "test.event",
								payload: { data: 1 },
								attempts: 2, // < maxRetries (5)
							},
						]),
					},
				});
			});

			// markProcessed throws → requeue
			mockPrisma.outboxEvent.update.mockRejectedValueOnce(
				new Error("Transient failure"),
			);
			// getAttempts returns 2 (< maxRetries)
			mockPrisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 2 });

			await processor.processOutbox();

			const updateCalls = mockPrisma.outboxEvent.update.mock.calls;
			expect(updateCalls.length).toBeGreaterThanOrEqual(1);
			const requeueCall = updateCalls.find(
				(call: any) => call[0].data?.status === "PENDING",
			);
			expect(requeueCall).toBeDefined();
			expect(requeueCall[0].where.id).toBe("event-3");
			expect(requeueCall[0].data.availableAt).toBeInstanceOf(Date);
			expect(requeueCall[0].data.lockedAt).toBeNull();
		});
	});

	describe("stale lock recovery", () => {
		it("should reset stale PROCESSING rows to PENDING", async () => {
			const { processor, mockPrisma } = createProcessor();

			mockPrisma.$executeRaw.mockResolvedValue(0);

			mockPrisma.$transaction.mockImplementation(async (fn: any) => {
				return fn({
					$queryRaw: jest.fn().mockResolvedValue([{ id: "event-4" }]),
					$executeRaw: jest.fn().mockResolvedValue(1),
					outboxEvent: {
						findMany: jest.fn().mockResolvedValue([
							{
								id: "event-4",
								eventType: "test.event",
								payload: { data: 1 },
								attempts: 1,
							},
						]),
					},
				});
			});

			mockPrisma.outboxEvent.update.mockResolvedValue({});

			await processor.processOutbox();

			// $executeRaw should have been called for stale lock recovery
			expect(mockPrisma.$executeRaw).toHaveBeenCalled();
		});
	});

	it("should calculate exponential backoff with jitter", () => {
		const { processor } = createProcessor();

		const calcBackoff = (processor as any).calculateBackoff.bind(processor);

		const delay1 = calcBackoff(1);
		expect(delay1).toBeGreaterThanOrEqual(0);
		expect(delay1).toBeLessThanOrEqual(2000);

		const delay2 = calcBackoff(2);
		expect(delay2).toBeLessThanOrEqual(4000);

		const delay5 = calcBackoff(5);
		expect(delay5).toBeLessThanOrEqual(60000);
	});

	describe("Phase 4 event types", () => {
		const PHASE_4_STUB_EVENTS = [
			"ExternalApplyClicked",
			"CandidateSaved",
			"CandidateAddedToTalentPool",
		] as const;

		it.each(
			PHASE_4_STUB_EVENTS,
		)("logs a debug stub for %s and does not warn (no-handler)", async (eventType) => {
			const { processor, mockLogger } = createProcessor();
			const event = { id: "evt-id", eventType, payload: {}, attempts: 0 };

			await (
				processor as unknown as {
					dispatch: (e: typeof event) => Promise<void>;
				}
			).dispatch(event);

			const debugCalls = mockLogger.debug.mock.calls.map((c: unknown[]) =>
				String(c[0]),
			);
			expect(
				debugCalls.some((m) =>
					m.includes(`Phase 4 stub handler for event type ${eventType}`),
				),
			).toBe(true);

			const warnCalls = mockLogger.warn.mock.calls.map((c: unknown[]) =>
				String(c[0]),
			);
			expect(
				warnCalls.some((m) => m.includes("No handler for event type")),
			).toBe(false);
		});

		it("RecruiterSeatAllocated routes to companySearchIndex AND notification", async () => {
			const { processor, mockCompanySearchIndex, mockNotification } =
				createProcessor();
			const event = {
				id: "evt-rs",
				eventType: "RecruiterSeatAllocated",
				payload: { companyId: "c1", recruiterUserId: "u1" },
				attempts: 0,
			};

			await (
				processor as unknown as {
					dispatch: (e: typeof event) => Promise<void>;
				}
			).dispatch(event);

			expect(mockCompanySearchIndex.processCompanyUpdated).toHaveBeenCalledWith(
				{
					companyId: "c1",
				},
			);
			expect(
				mockNotification.processRecruiterSeatAllocated,
			).toHaveBeenCalledWith({
				companyId: "c1",
				recruiterUserId: "u1",
			});
		});

		it("ApplicationSubmitted routes to notification.processApplicationSubmitted", async () => {
			const { processor, mockNotification } = createProcessor();
			const event = {
				id: "evt-as",
				eventType: "ApplicationSubmitted",
				payload: {
					applicationId: "app-1",
					jobId: "job-1",
					companyId: "company-1",
					candidateUserId: "candidate-1",
				},
				attempts: 0,
			};

			await (
				processor as unknown as {
					dispatch: (e: typeof event) => Promise<void>;
				}
			).dispatch(event);

			expect(mockNotification.processApplicationSubmitted).toHaveBeenCalledWith(
				expect.objectContaining({ applicationId: "app-1" }),
			);
		});

		it("ApplicationNoteAdded routes to notification.processApplicationNoteAdded", async () => {
			const { processor, mockNotification } = createProcessor();
			const event = {
				id: "evt-an",
				eventType: "ApplicationNoteAdded",
				payload: {
					applicationId: "app-1",
					noteId: "note-1",
					authorUserId: "u1",
					companyId: "c1",
				},
				attempts: 0,
			};

			await (
				processor as unknown as {
					dispatch: (e: typeof event) => Promise<void>;
				}
			).dispatch(event);

			expect(mockNotification.processApplicationNoteAdded).toHaveBeenCalledWith(
				expect.objectContaining({ noteId: "note-1" }),
			);
		});
	});

	describe("Job search index routing", () => {
		const JOB_EVENTS = [
			{ eventType: "JobCreated", method: "processJobCreated" },
			{ eventType: "JobUpdated", method: "processJobUpdated" },
			{ eventType: "JobPublished", method: "processJobPublished" },
			{ eventType: "JobClosed", method: "processJobClosed" },
			{ eventType: "JobDeleted", method: "processJobDeleted" },
		] as const;

		it.each(JOB_EVENTS)("routes $eventType to jobSearchIndex.$method", async ({
			eventType,
			method,
		}) => {
			const { processor, mockJobSearchIndex } = createProcessor();
			const event = {
				id: "evt-job",
				eventType,
				payload: { jobId: "job-1" },
				attempts: 0,
			};

			await (
				processor as unknown as {
					dispatch: (e: typeof event) => Promise<void>;
				}
			).dispatch(event);

			expect(
				(mockJobSearchIndex as Record<string, jest.Mock>)[method],
			).toHaveBeenCalledWith({
				jobId: "job-1",
			});
		});
	});

	it("routes ApplicationStatusChanged to applicationEmail.processApplicationStatusChanged", async () => {
		const { processor, mockApplicationEmail } = createProcessor();
		const event = {
			id: "evt-app",
			eventType: "ApplicationStatusChanged",
			payload: { applicationId: "app-1", toStatus: "INTERVIEW" },
			attempts: 0,
		};

		await (
			processor as unknown as {
				dispatch: (e: typeof event) => Promise<void>;
			}
		).dispatch(event);

		expect(
			mockApplicationEmail.processApplicationStatusChanged,
		).toHaveBeenCalledWith({
			applicationId: "app-1",
			toStatus: "INTERVIEW",
		});
	});
});
