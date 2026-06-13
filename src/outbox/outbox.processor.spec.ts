import { OutboxProcessor } from "./outbox.processor";

describe("OutboxProcessor", () => {
  function createProcessor() {
    const mockPrisma = {
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(0),
      job: {
        update: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
    const mockJobAlertProcessor = {
      processJobPublished: jest.fn().mockResolvedValue(undefined),
    };
    const mockMediaScanProcessor = {
      onVirusScanned: jest.fn().mockResolvedValue(undefined),
      onThumbnailsGenerated: jest.fn().mockResolvedValue(undefined),
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
      processUserStatusChanged: jest.fn().mockResolvedValue(undefined),
      processCandidateSaved: jest.fn().mockResolvedValue(undefined),
      processCandidateAddedToTalentPool: jest.fn().mockResolvedValue(undefined),
    };
    const mockPostInteraction = {
      processPostCreated: jest.fn(),
      processCommentAdded: jest.fn(),
      processReactionAdded: jest.fn(),
      processMentionCreated: jest.fn(),
      processMentionRemoved: jest.fn(),
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
      processProfileRemoved: jest.fn(),
    };
    const mockProfileCreation = {
      processUserRegistered: jest.fn().mockResolvedValue(undefined),
    };

    const mockBillingProcessor = {
      processPaymentProviderEvent: jest.fn().mockResolvedValue(undefined),
    };
    const mockBillingAdvancedProcessor = {
      processSubscriptionUpgraded: jest.fn().mockResolvedValue(undefined),
      processSubscriptionDowngraded: jest.fn().mockResolvedValue(undefined),
      processSubscriptionStatusChanged: jest.fn().mockResolvedValue(undefined),
      processInvoiceCreated: jest.fn().mockResolvedValue(undefined),
      processInvoicePaymentFailed: jest.fn().mockResolvedValue(undefined),
      processPaymentMethodAdded: jest.fn().mockResolvedValue(undefined),
      processPaymentMethodRemoved: jest.fn().mockResolvedValue(undefined),
      processUsageThresholdReached: jest.fn().mockResolvedValue(undefined),
    };
    const mockSubscriptionProcessor = {
      createFreeSubscription: jest.fn().mockResolvedValue(undefined),
    };
    const mockRecruitingProcessor = {
      processInterviewScheduled: jest.fn().mockResolvedValue(undefined),
      processInterviewCompleted: jest.fn().mockResolvedValue(undefined),
      processScorecardSubmitted: jest.fn().mockResolvedValue(undefined),
      processOfferSent: jest.fn().mockResolvedValue(undefined),
      processOfferResponded: jest.fn().mockResolvedValue(undefined),
    };
    const mockExperimentTrackingProcessor = {
      process: jest.fn().mockResolvedValue(undefined),
    };
    const mockPushNotificationProcessor = {
      process: jest.fn().mockResolvedValue(undefined),
    };
    const mockRealtimeGateway = {
      pushNotification: jest.fn(),
    };
    const mockMetrics = {
      recordProcessed: jest.fn(),
      recordFailed: jest.fn(),
      recordDeadLettered: jest.fn(),
      recordDispatchDuration: jest.fn(),
      registerPendingGauge: jest.fn(),
      unregisterPendingGauge: jest.fn(),
    };
    const mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const processor = new OutboxProcessor(
      mockPrisma as any,
      mockConfig as any,
      mockDeadLetter as any,
      mockCompanySearchIndex as any,
      mockJobAlertProcessor as any,
      mockMediaScanProcessor as any,
      mockJobSearchIndex as any,
      mockApplicationEmail as any,
      mockNotification as any,
      mockMessagingProcessor as any,
      mockPostInteraction as any,
      mockPostSearchIndex as any,
      mockProfileCreation as any,
      mockProfileSearchIndex as any,
      mockBillingAdvancedProcessor as any,
      mockBillingProcessor as any,
      mockSubscriptionProcessor as any,
      mockRecruitingProcessor as any,
      mockExperimentTrackingProcessor as any,
      mockPushNotificationProcessor as any,
      mockMetrics as any,
      mockRealtimeGateway as any,
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
      mockPostInteraction,
      mockPostSearchIndex,
      mockProfileCreation,
      mockMetrics,
      mockLogger,
    };
  }

  it("registers pending-count gauge callback", async () => {
    const { mockMetrics, mockPrisma } = createProcessor();
    mockPrisma.outboxEvent.count.mockResolvedValue(3);
    const [readPendingCount] = mockMetrics.registerPendingGauge.mock.calls[0] as [
      () => Promise<number>,
      (error: unknown) => void,
    ];

    await expect(readPendingCount()).resolves.toBe(3);
    expect(mockPrisma.outboxEvent.count).toHaveBeenCalledWith({
      where: { status: "PENDING" },
    });
  });

  describe("claimEvents", () => {
    it("should claim events atomically via transaction", async () => {
      const { processor, mockPrisma } = createProcessor();

      const mockEvents = [{ id: "event-1", eventType: "test.event", payload: { foo: "bar" } }];
      const executeRaw = jest.fn().mockResolvedValue(1);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: "event-1" }]),
          $executeRaw: executeRaw,
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue(mockEvents),
          },
        });
      });

      const claimed = await processor.claimEvents();
      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe("event-1");
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(String.raw(executeRaw.mock.calls[0][0])).not.toContain("attempts");
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
      const { processor, mockPrisma, mockMetrics, mockProfileCreation } = createProcessor();

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
                eventType: "UserRegistered",
                payload: {
                  userId: "user-1",
                  email: "test@example.com",
                  createdAt: new Date().toISOString(),
                },
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
      expect(mockMetrics.recordProcessed).toHaveBeenCalledWith("UserRegistered");
      expect(mockMetrics.recordDispatchDuration).toHaveBeenCalledWith(
        "UserRegistered",
        "success",
        expect.any(Number),
      );
      expect(mockProfileCreation.processUserRegistered).toHaveBeenCalledWith({
        userId: "user-1",
        email: "test@example.com",
        createdAt: expect.any(String),
      });
    });

    it("processes independent aggregate groups in parallel", async () => {
      const { processor, mockPrisma, mockJobSearchIndex } = createProcessor();
      let releaseSlowHandler: () => void = () => undefined;
      const slowHandler = new Promise<void>((resolve) => {
        releaseSlowHandler = resolve;
      });
      mockJobSearchIndex.processJobCreated.mockReturnValueOnce(slowHandler);
      mockPrisma.$executeRaw.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: "event-slow" }, { id: "event-fast" }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: "event-slow",
                eventType: "JobCreated",
                aggregateType: "Job",
                aggregateId: "job-1",
                payload: {
                  jobId: "job-1",
                  companyId: "company-1",
                  createdByUserId: "user-1",
                },
                attempts: 0,
              },
              {
                id: "event-fast",
                eventType: "UserRegistered",
                aggregateType: "User",
                aggregateId: "user-1",
                payload: {
                  userId: "user-1",
                  email: "test@example.com",
                  createdAt: new Date().toISOString(),
                },
                attempts: 0,
              },
            ]),
          },
        });
      });
      mockPrisma.outboxEvent.update.mockResolvedValue({});

      const processing = processor.processOutbox();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "event-fast" },
          data: expect.objectContaining({ status: "PROCESSED" }),
        }),
      );

      releaseSlowHandler();
      await processing;
    });

    it("should move exhausted events to dead-letter", async () => {
      const { processor, mockPrisma, mockDeadLetter, mockCompanySearchIndex, mockMetrics } =
        createProcessor();

      mockPrisma.$executeRaw.mockResolvedValue(0);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: "event-2" }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: "event-2",
                eventType: "CompanyCreated",
                payload: { companyId: "company-1" },
                attempts: 6, // > maxRetries (5)
              },
            ]),
          },
        });
      });

      mockCompanySearchIndex.processCompanyCreated.mockRejectedValue(new Error("Handler failed"));
      mockPrisma.outboxEvent.update.mockResolvedValueOnce({ attempts: 5 });

      await processor.processOutbox();

      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "event-2" },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      expect(mockDeadLetter.moveToDeadLetter).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "event-2",
          eventType: "CompanyCreated",
        }),
        expect.any(Error),
      );
      expect(mockMetrics.recordFailed).toHaveBeenCalledWith("CompanyCreated", 5);
      expect(mockMetrics.recordDeadLettered).toHaveBeenCalledWith("CompanyCreated");
      expect(mockMetrics.recordDispatchDuration).toHaveBeenCalledWith(
        "CompanyCreated",
        "failure",
        expect.any(Number),
      );
    });

    it("should requeue events with backoff on transient failure", async () => {
      const { processor, mockPrisma, mockMetrics } = createProcessor();

      mockPrisma.$executeRaw.mockResolvedValue(0);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: "event-3" }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: "event-3",
                eventType: "UserRegistered",
                payload: {
                  userId: "user-1",
                  email: "test@example.com",
                  createdAt: new Date().toISOString(),
                },
                attempts: 2, // < maxRetries (5)
              },
            ]),
          },
        });
      });

      mockPrisma.outboxEvent.update
        // markProcessed throws → requeue
        .mockRejectedValueOnce(new Error("Transient failure"))
        // recordFailure returns current failed attempt count
        .mockResolvedValueOnce({ attempts: 2 })
        .mockResolvedValueOnce({});

      await processor.processOutbox();

      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "event-3" },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const updateCalls = mockPrisma.outboxEvent.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
      const requeueCall = updateCalls.find((call: any) => call[0].data?.status === "PENDING");
      expect(requeueCall).toBeDefined();
      expect(requeueCall[0].where.id).toBe("event-3");
      expect(requeueCall[0].data.availableAt).toBeInstanceOf(Date);
      expect(requeueCall[0].data.lockedAt).toBeNull();
      expect(mockMetrics.recordFailed).toHaveBeenCalledWith("UserRegistered", 2);
      expect(mockMetrics.recordDeadLettered).not.toHaveBeenCalled();
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
                eventType: "UserRegistered",
                payload: {
                  userId: "user-1",
                  email: "test@example.com",
                  createdAt: new Date().toISOString(),
                },
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

  describe("shutdown lock release", () => {
    it("releases locks owned by this processor", async () => {
      const { processor, mockPrisma, mockLogger, mockMetrics } = createProcessor();
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 2 });

      await processor.onApplicationShutdown();

      expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: {
          status: "PROCESSING",
          lockedBy: expect.any(String),
        },
        data: {
          status: "PENDING",
          lockedAt: null,
          lockedBy: null,
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith("Released %d outbox locks during shutdown", 2);
      expect(mockMetrics.unregisterPendingGauge).toHaveBeenCalled();
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

  describe("Candidate notification routing (Phase B T5)", () => {
    const CANDIDATE_EVENTS = [
      {
        eventType: "CandidateSaved",
        method: "processCandidateSaved",
        payload: {
          savedCandidateId: "saved-1",
          companyId: "company-1",
          candidateUserId: "candidate-1",
          savedByUserId: "user-1",
        },
      },
      {
        eventType: "CandidateAddedToTalentPool",
        method: "processCandidateAddedToTalentPool",
        payload: {
          talentPoolCandidateId: "tpc-1",
          talentPoolId: "pool-1",
          companyId: "company-1",
          candidateUserId: "candidate-1",
        },
      },
    ] as const;

    it.each(CANDIDATE_EVENTS)(
      "routes $eventType to notification.$method",
      async ({ eventType, method, payload }) => {
        const { processor, mockNotification } = createProcessor();
        const event = { id: "evt-1", eventType, payload, attempts: 0 };

        await (
          processor as unknown as {
            dispatch: (e: typeof event) => Promise<void>;
          }
        ).dispatch(event);

        expect((mockNotification as Record<string, jest.Mock>)[method]).toHaveBeenCalledWith(
          expect.objectContaining(payload),
        );
      },
    );
  });

  describe("Analytics / external actions", () => {
    it("handles ExternalApplyClicked by incrementing job click count", async () => {
      const { processor, mockPrisma, mockLogger } = createProcessor();
      const event = {
        id: "evt-eac",
        eventType: "ExternalApplyClicked",
        payload: {
          jobId: "job-1",
          companyId: "company-1",
          userId: null,
          occurredAt: new Date().toISOString(),
        },
        attempts: 0,
      };

      await (
        processor as unknown as {
          dispatch: (e: typeof event) => Promise<void>;
        }
      ).dispatch(event);

      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { externalClickCount: { increment: 1 } },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("ExternalApplyClicked"),
      );
    });

    it("rejects malformed payload before dispatching handlers", async () => {
      const { processor, mockCompanySearchIndex } = createProcessor();
      const event = {
        id: "evt-bad",
        eventType: "CompanyCreated",
        payload: {},
        attempts: 0,
      };

      await expect(
        (
          processor as unknown as {
            dispatch: (e: typeof event) => Promise<void>;
          }
        ).dispatch(event),
      ).rejects.toThrow("Invalid outbox payload for CompanyCreated");
      expect(mockCompanySearchIndex.processCompanyCreated).not.toHaveBeenCalled();
    });

    it("RecruiterSeatAllocated routes to companySearchIndex AND notification", async () => {
      const { processor, mockCompanySearchIndex, mockNotification } = createProcessor();
      const event = {
        id: "evt-rs",
        eventType: "RecruiterSeatAllocated",
        payload: {
          companyId: "c1",
          seatId: "seat-1",
          recruiterUserId: "u1",
          allocatedBy: "admin-1",
        },
        attempts: 0,
      };

      await (
        processor as unknown as {
          dispatch: (e: typeof event) => Promise<void>;
        }
      ).dispatch(event);

      expect(mockCompanySearchIndex.processCompanyUpdated).toHaveBeenCalledWith({
        companyId: "c1",
      });
      expect(mockNotification.processRecruiterSeatAllocated).toHaveBeenCalledWith({
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

    it("MentionRemoved routes to postInteraction.processMentionRemoved", async () => {
      const { processor, mockPostInteraction } = createProcessor();
      const event = {
        id: "evt-mr",
        eventType: "MentionRemoved",
        payload: {
          postId: "post-1",
          mentionedUserId: "user-2",
          mentionerUserId: "user-1",
          mentionId: "mention-1",
        },
        attempts: 0,
      };

      await (
        processor as unknown as {
          dispatch: (e: typeof event) => Promise<void>;
        }
      ).dispatch(event);

      expect(mockPostInteraction.processMentionRemoved).toHaveBeenCalledWith(
        expect.objectContaining({ postId: "post-1" }),
      );
    });

    it("PostContentChanged routes to postSearchIndex.processPostUpdated", async () => {
      const { processor, mockPostSearchIndex } = createProcessor();
      const event = {
        id: "evt-pcc",
        eventType: "PostContentChanged",
        payload: { postId: "post-1", authorId: "user-1" },
        attempts: 0,
      };

      await (
        processor as unknown as {
          dispatch: (e: typeof event) => Promise<void>;
        }
      ).dispatch(event);

      expect(mockPostSearchIndex.processPostUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ postId: "post-1" }),
      );
    });

    it("UserStatusChanged routes to notification.processUserStatusChanged", async () => {
      const { processor, mockNotification } = createProcessor();
      const event = {
        id: "evt-usc",
        eventType: "UserStatusChanged",
        payload: {
          userId: "user-1",
          previousStatus: "ACTIVE",
          newStatus: "SUSPENDED",
          changedBy: "admin-1",
          reason: "spam",
        },
        attempts: 0,
      };

      await (
        processor as unknown as {
          dispatch: (e: typeof event) => Promise<void>;
        }
      ).dispatch(event);

      expect(mockNotification.processUserStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          previousStatus: "ACTIVE",
          newStatus: "SUSPENDED",
        }),
      );
    });
  });

  describe("Job search index routing", () => {
    const JOB_EVENTS = [
      {
        eventType: "JobCreated",
        method: "processJobCreated",
        payload: {
          jobId: "job-1",
          companyId: "company-1",
          createdByUserId: "user-1",
        },
      },
      {
        eventType: "JobUpdated",
        method: "processJobUpdated",
        payload: {
          jobId: "job-1",
          companyId: "company-1",
          changes: { title: "new" },
        },
      },
      {
        eventType: "JobPublished",
        method: "processJobPublished",
        payload: { jobId: "job-1", companyId: "company-1" },
      },
      {
        eventType: "JobClosed",
        method: "processJobClosed",
        payload: { jobId: "job-1", companyId: "company-1" },
      },
      {
        eventType: "JobDeleted",
        method: "processJobDeleted",
        payload: { jobId: "job-1", companyId: "company-1" },
      },
    ] as const;

    it.each(JOB_EVENTS)(
      "routes $eventType to jobSearchIndex.$method",
      async ({ eventType, method, payload }) => {
        const { processor, mockJobSearchIndex } = createProcessor();
        const event = {
          id: "evt-job",
          eventType,
          payload,
          attempts: 0,
        };

        await (
          processor as unknown as {
            dispatch: (e: typeof event) => Promise<void>;
          }
        ).dispatch(event);

        expect((mockJobSearchIndex as Record<string, jest.Mock>)[method]).toHaveBeenCalledWith(
          expect.objectContaining({ jobId: "job-1" }),
        );
      },
    );
  });

  it("routes ApplicationStatusChanged to applicationEmail.processApplicationStatusChanged", async () => {
    const { processor, mockApplicationEmail } = createProcessor();
    const event = {
      id: "evt-app",
      eventType: "ApplicationStatusChanged",
      payload: {
        applicationId: "app-1",
        fromStatus: "SUBMITTED",
        toStatus: "INTERVIEW",
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

    expect(mockApplicationEmail.processApplicationStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        toStatus: "INTERVIEW",
      }),
    );
  });
});
