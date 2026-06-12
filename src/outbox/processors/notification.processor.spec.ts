import { Logger } from '@nestjs/common';
import { NotificationProcessor } from './notification.processor';

interface MockPrisma {
  application: { findUnique: jest.Mock };
  companyMember: { findMany: jest.Mock };
  recruiterSeat: { findMany: jest.Mock; findFirst: jest.Mock };
  savedCandidate: { findFirst: jest.Mock };
  talentPoolCandidate: { findFirst: jest.Mock };
  notification: { create: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
}

interface MockIdempotency {
  claim: jest.Mock;
}

interface MockOutboxService {
  emit: jest.Mock;
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
    savedCandidate: { findFirst: jest.fn().mockResolvedValue({ id: 'sc-1' }) },
    talentPoolCandidate: {
      findFirst: jest.fn().mockResolvedValue({ id: 'tpc-1' }),
    },
    notification: {
      create: jest.fn().mockResolvedValue({
        id: 'notif-1',
        createdAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    // $transaction forwards its callback so the outbox.emit() inside it runs
    // against the same mock client. Most tests don't care; the push-emit
    // tests override this to assert transaction usage.
    $transaction: jest
      .fn()
      .mockImplementation(async (cb) =>
        cb({ outboxEvent: { create: jest.fn() } }),
      ),
  };
  const idempotency: MockIdempotency = {
    claim: jest.fn().mockResolvedValue({ id: 'idem-1' }),
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
  const outboxService: MockOutboxService = {
    emit: jest.fn().mockResolvedValue(undefined),
  };
  const processor = new NotificationProcessor(
    prisma as never,
    idempotency as never,
    realtimeGateway as never,
    outboxService,
  );
  return {
    processor,
    prisma,
    idempotency,
    logger,
    realtimeGateway,
    outboxService,
  };
}

describe('NotificationProcessor', () => {
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });
  describe('processApplicationSubmitted', () => {
    it('inserts notifications for OWNER + ADMIN + active seat holders', async () => {
      const { processor, prisma } = createProcessor();
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      prisma.companyMember.findMany.mockResolvedValue([
        { userId: 'owner-1' },
        { userId: 'admin-1' },
      ]);
      prisma.recruiterSeat.findMany.mockResolvedValue([
        { userId: 'seat-user-1' },
        { userId: 'seat-user-2' },
      ]);

      await processor.processApplicationSubmitted({
        applicationId: 'app-1',
        jobId: 'job-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledTimes(4);
    });

    it('dedupes when a user is both ADMIN and seat holder', async () => {
      const { processor, prisma } = createProcessor();
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      prisma.companyMember.findMany.mockResolvedValue([{ userId: 'shared-1' }]);
      prisma.recruiterSeat.findMany.mockResolvedValue([{ userId: 'shared-1' }]);

      await processor.processApplicationSubmitted({
        applicationId: 'app-1',
        jobId: 'job-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('skips on replay when notification already exists', async () => {
      const { processor, prisma } = createProcessor();
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      prisma.companyMember.findMany.mockResolvedValue([{ userId: 'owner-1' }]);
      prisma.notification.findFirst.mockResolvedValue({ id: 'notif-exists' });

      await processor.processApplicationSubmitted({
        applicationId: 'app-1',
        jobId: 'job-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('is a graceful no-op when application not found', async () => {
      const { processor, prisma } = createProcessor();
      prisma.application.findUnique.mockResolvedValue(null);

      await processor.processApplicationSubmitted({
        applicationId: 'missing',
        jobId: 'job-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('processApplicationStatusChanged', () => {
    it('notifies only the candidate for non-WITHDRAWN transitions', async () => {
      const { processor, prisma } = createProcessor();
      prisma.application.findUnique.mockResolvedValue({
        id: 'app-1',
        userId: 'candidate-1',
      });

      await processor.processApplicationStatusChanged({
        applicationId: 'app-1',
        toStatus: 'REVIEWED',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'candidate-1' }),
        }),
      );
    });

    it('notifies candidate + recruiter set on WITHDRAWN', async () => {
      const { processor, prisma } = createProcessor();
      prisma.application.findUnique.mockResolvedValue({
        id: 'app-1',
        userId: 'candidate-1',
      });
      prisma.companyMember.findMany.mockResolvedValue([{ userId: 'admin-1' }]);
      prisma.recruiterSeat.findMany.mockResolvedValue([
        { userId: 'recruiter-1' },
      ]);

      await processor.processApplicationStatusChanged({
        applicationId: 'app-1',
        toStatus: 'WITHDRAWN',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('processApplicationNoteAdded', () => {
    it('excludes the note author from recipients', async () => {
      const { processor, prisma } = createProcessor();
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      prisma.companyMember.findMany.mockResolvedValue([
        { userId: 'admin-1' },
        { userId: 'author-1' },
      ]);

      await processor.processApplicationNoteAdded({
        applicationId: 'app-1',
        noteId: 'note-1',
        authorUserId: 'author-1',
        companyId: 'company-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'admin-1' }),
        }),
      );
    });
  });

  describe('processRecruiterSeatAllocated', () => {
    it('inserts one notification for the recruiter', async () => {
      const { processor, prisma } = createProcessor();
      prisma.recruiterSeat.findFirst.mockResolvedValue({ id: 'seat-1' });

      await processor.processRecruiterSeatAllocated({
        recruiterUserId: 'recruiter-1',
        companyId: 'company-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'recruiter-1',
            type: 'RecruiterSeatAllocated',
          }),
        }),
      );
    });

    it('is a no-op when seat is not found', async () => {
      const { processor, prisma } = createProcessor();
      prisma.recruiterSeat.findFirst.mockResolvedValue(null);

      await processor.processRecruiterSeatAllocated({
        recruiterUserId: 'recruiter-1',
        companyId: 'company-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('idempotency key format', () => {
    it('builds key as recipientUserId:eventType:aggregateId', async () => {
      const { processor, prisma, idempotency } = createProcessor();
      prisma.recruiterSeat.findFirst.mockResolvedValue({ id: 'seat-42' });

      await processor.processRecruiterSeatAllocated({
        recruiterUserId: 'user-99',
        companyId: 'company-1',
      });

      expect(idempotency.claim).toHaveBeenCalledWith(
        'Notification',
        'user-99:RecruiterSeatAllocated:seat-42',
      );
    });
  });

  describe('processCandidateSaved', () => {
    it('inserts a notification for the candidate when the saved row exists', async () => {
      const { processor, prisma } = createProcessor();
      prisma.savedCandidate.findFirst.mockResolvedValue({ id: 'sc-1' });

      await processor.processCandidateSaved({
        savedCandidateId: 'sc-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
        savedByUserId: 'recruiter-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'candidate-1',
            type: 'CandidateSaved',
          }),
        }),
      );
    });

    it('skips when the saved-candidate row is missing or soft-deleted', async () => {
      const { processor, prisma } = createProcessor();
      prisma.savedCandidate.findFirst.mockResolvedValue(null);

      await processor.processCandidateSaved({
        savedCandidateId: 'sc-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
        savedByUserId: 'recruiter-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('processCandidateAddedToTalentPool', () => {
    it('inserts a notification for the candidate when the membership exists', async () => {
      const { processor, prisma } = createProcessor();
      prisma.talentPoolCandidate.findFirst.mockResolvedValue({ id: 'tpc-1' });

      await processor.processCandidateAddedToTalentPool({
        talentPoolCandidateId: 'tpc-1',
        talentPoolId: 'pool-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'candidate-1',
            type: 'CandidateAddedToTalentPool',
          }),
        }),
      );
    });

    it('skips when the membership is missing or soft-deleted', async () => {
      const { processor, prisma } = createProcessor();
      prisma.talentPoolCandidate.findFirst.mockResolvedValue(null);

      await processor.processCandidateAddedToTalentPool({
        talentPoolCandidateId: 'tpc-1',
        talentPoolId: 'pool-1',
        companyId: 'company-1',
        candidateUserId: 'candidate-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('push notification emission', () => {
    it('emits PushNotificationRequired for ConnectionAccepted → connection_accepted', async () => {
      const { processor, prisma, outboxService } = createProcessor();

      await processor.processConnectionAccepted({
        connectionId: 'conn-1',
        requesterUserId: 'user-1',
        targetUserId: 'user-2',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(outboxService.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'PushNotificationRequired',
          aggregateType: 'Notification',
          aggregateId: 'notif-1',
          payload: expect.objectContaining({
            userId: 'user-1',
            type: 'connection_accepted',
            title: 'Connection accepted',
            body: 'Your connection request was accepted',
            data: { notificationId: 'notif-1' },
          }),
        }),
      );
    });

    it('emits PushNotificationRequired for ApplicationStatusChanged → application_status_change', async () => {
      const { processor, prisma, outboxService } = createProcessor();
      prisma.application.findUnique.mockResolvedValue({
        id: 'app-1',
        userId: 'user-1',
      });

      await processor.processApplicationStatusChanged({
        applicationId: 'app-1',
        toStatus: 'REVIEWED',
        companyId: 'company-1',
        candidateUserId: 'user-1',
      });

      expect(outboxService.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'PushNotificationRequired',
          payload: expect.objectContaining({
            userId: 'user-1',
            type: 'application_status_change',
          }),
        }),
      );
    });

    it('uses the lowercased event name for unmapped notification types', async () => {
      const { processor, prisma, outboxService } = createProcessor();
      prisma.savedCandidate.findFirst.mockResolvedValue({ id: 'sc-1' });

      await processor.processCandidateSaved({
        savedCandidateId: 'sc-1',
        companyId: 'company-1',
        candidateUserId: 'user-1',
        savedByUserId: 'recruiter-1',
      });

      expect(outboxService.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payload: expect.objectContaining({
            type: 'candidatesaved',
          }),
        }),
      );
    });

    it('skips push emission when notification is a duplicate (replay)', async () => {
      const { processor, prisma, outboxService } = createProcessor();
      prisma.savedCandidate.findFirst.mockResolvedValue({ id: 'sc-1' });
      prisma.notification.findFirst.mockResolvedValue({ id: 'notif-existing' });

      await processor.processCandidateSaved({
        savedCandidateId: 'sc-1',
        companyId: 'company-1',
        candidateUserId: 'user-1',
        savedByUserId: 'recruiter-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(outboxService.emit).not.toHaveBeenCalled();
    });

    it('warns and does not throw when the outbox emit fails', async () => {
      const { processor, outboxService } = createProcessor();
      outboxService.emit.mockRejectedValue(new Error('db down'));

      // Should not throw — push emit is best-effort
      await expect(
        processor.processConnectionAccepted({
          connectionId: 'conn-1',
          requesterUserId: 'user-1',
          targetUserId: 'user-2',
        }),
      ).resolves.not.toThrow();

      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
