import { Injectable, Logger } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { IdempotencyService } from '../idempotency.service';

interface ApplicationSubmittedPayload {
  applicationId: string;
  jobId: string;
  companyId: string;
  candidateUserId: string;
}

interface ApplicationStatusChangedPayload {
  applicationId: string;
  fromStatus?: string;
  toStatus: string;
  companyId: string;
  candidateUserId: string;
  changedByUserId?: string;
  reason?: string | null;
}

interface ApplicationNoteAddedPayload {
  applicationId: string;
  noteId: string;
  authorUserId: string;
  companyId: string;
}

interface RecruiterSeatAllocatedPayload {
  recruiterUserId: string;
  companyId: string;
  seatId?: string;
}

interface ConnectionRequestedPayload {
  connectionId: string;
  requesterUserId: string;
  targetUserId: string;
}

interface ConnectionAcceptedPayload {
  connectionId: string;
  requesterUserId: string;
  targetUserId: string;
}

interface UserBlockedPayload {
  blockerUserId: string;
  blockedUserId: string;
}

interface PrismaForRecipients {
  companyMember: {
    findMany: (args: unknown) => Promise<Array<{ userId: string }>>;
  };
  recruiterSeat: {
    findMany: (args: unknown) => Promise<Array<{ userId: string | null }>>;
  };
}

async function resolveCompanyRecruiters(
  prisma: PrismaForRecipients,
  companyId: string,
): Promise<string[]> {
  const [members, seats] = await Promise.all([
    prisma.companyMember.findMany({
      where: {
        companyId,
        status: 'active',
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { userId: true },
    }),
    prisma.recruiterSeat.findMany({
      where: {
        companyId,
        status: 'allocated',
        userId: { not: null },
      },
      select: { userId: true },
    }),
  ]);

  const userIds = new Set<string>();
  for (const m of members) userIds.add(m.userId);
  for (const s of seats) if (s.userId) userIds.add(s.userId);
  return [...userIds];
}

/**
 * NotificationProcessor — outbox consumer that fans Phase 4 domain events
 * into per-recipient `Notification` rows.
 *
 * Replay safety: each (recipient, event, aggregate) tuple is gated by an
 * IdempotencyKey claim. Duplicate dispatches are no-ops.
 */
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async processApplicationSubmitted(
    payload: ApplicationSubmittedPayload,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { id: true },
    });
    if (!application) {
      this.logger.warn(
        `Application ${payload.applicationId} not found for ApplicationSubmitted notification - skipping`,
      );
      return;
    }

    const recipients = await resolveCompanyRecruiters(
      this.prisma,
      payload.companyId,
    );

    let inserted = 0;
    for (const recipientUserId of recipients) {
      const created = await this.insertNotification({
        recipientUserId,
        eventType: 'ApplicationSubmitted',
        aggregateId: payload.applicationId,
        type: 'ApplicationSubmitted',
        payloadJson: payload as unknown as Record<string, unknown>,
        title: 'New application',
        body: `A new application was submitted for job ${payload.jobId}`,
        actionUrl: `/applications/${payload.applicationId}`,
        aggregateIdJsonField: 'applicationId',
      });
      if (created) inserted++;
    }

    this.logger.debug(
      `ApplicationSubmitted: inserted ${inserted} notification rows for application=${payload.applicationId}`,
    );
  }

  async processApplicationStatusChanged(
    payload: ApplicationStatusChangedPayload,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { id: true, userId: true },
    });
    if (!application) {
      this.logger.warn(
        `Application ${payload.applicationId} not found for ApplicationStatusChanged notification - skipping`,
      );
      return;
    }

    const recipients = new Set<string>();
    recipients.add(payload.candidateUserId);

    if (payload.toStatus === 'WITHDRAWN') {
      const recruiterIds = await resolveCompanyRecruiters(
        this.prisma,
        payload.companyId,
      );
      for (const id of recruiterIds) recipients.add(id);
    }

    let inserted = 0;
    for (const recipientUserId of recipients) {
      const created = await this.insertNotification({
        recipientUserId,
        eventType: 'ApplicationStatusChanged',
        aggregateId: payload.applicationId,
        type: 'ApplicationStatusChanged',
        payloadJson: payload as unknown as Record<string, unknown>,
        title: 'Application status updated',
        body: `Application status changed to ${payload.toStatus}`,
        actionUrl: `/applications/${payload.applicationId}`,
        aggregateIdJsonField: 'applicationId',
      });
      if (created) inserted++;
    }

    this.logger.debug(
      `ApplicationStatusChanged: inserted ${inserted} notification rows for application=${payload.applicationId}`,
    );
  }

  async processApplicationNoteAdded(
    payload: ApplicationNoteAddedPayload,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { id: true },
    });
    if (!application) {
      this.logger.warn(
        `Application ${payload.applicationId} not found for ApplicationNoteAdded notification - skipping`,
      );
      return;
    }

    const allRecruiters = await resolveCompanyRecruiters(
      this.prisma,
      payload.companyId,
    );
    const recipients = allRecruiters.filter(
      (id) => id !== payload.authorUserId,
    );

    let inserted = 0;
    for (const recipientUserId of recipients) {
      const created = await this.insertNotification({
        recipientUserId,
        eventType: 'ApplicationNoteAdded',
        aggregateId: payload.noteId,
        type: 'ApplicationNoteAdded',
        payloadJson: payload as unknown as Record<string, unknown>,
        title: 'New note on application',
        body: `A note was added to application ${payload.applicationId}`,
        actionUrl: `/applications/${payload.applicationId}`,
        aggregateIdJsonField: 'noteId',
      });
      if (created) inserted++;
    }

    this.logger.debug(
      `ApplicationNoteAdded: inserted ${inserted} notification rows for note=${payload.noteId}`,
    );
  }

  async processRecruiterSeatAllocated(
    payload: RecruiterSeatAllocatedPayload,
  ): Promise<void> {
    const seat = await this.prisma.recruiterSeat.findFirst({
      where: {
        companyId: payload.companyId,
        userId: payload.recruiterUserId,
        status: 'allocated',
      },
      select: { id: true },
    });
    if (!seat) {
      this.logger.warn(
        `RecruiterSeat for user ${payload.recruiterUserId} in company ${payload.companyId} not found - skipping`,
      );
      return;
    }

    const created = await this.insertNotification({
      recipientUserId: payload.recruiterUserId,
      eventType: 'RecruiterSeatAllocated',
      aggregateId: seat.id,
      type: 'RecruiterSeatAllocated',
      payloadJson: { ...payload, seatId: seat.id },
      title: 'You were allocated a recruiter seat',
      body: `You have been granted a recruiter seat for company ${payload.companyId}`,
      actionUrl: `/companies/${payload.companyId}`,
      aggregateIdJsonField: 'seatId',
    });

    this.logger.debug(
      `RecruiterSeatAllocated: ${created ? 'inserted' : 'skipped (duplicate)'} notification row for user=${payload.recruiterUserId}`,
    );
  }

  async processConnectionRequested(
    payload: ConnectionRequestedPayload,
  ): Promise<void> {
    const created = await this.insertNotification({
      recipientUserId: payload.targetUserId,
      eventType: 'ConnectionRequested',
      aggregateId: payload.connectionId,
      type: 'ConnectionRequested',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'New connection request',
      body: 'You have a new connection request',
      actionUrl: '/connections/pending',
      aggregateIdJsonField: 'connectionId',
    });

    this.logger.debug(
      `ConnectionRequested: ${created ? 'inserted' : 'skipped'} notification for target=${payload.targetUserId}`,
    );
  }

  async processConnectionAccepted(
    payload: ConnectionAcceptedPayload,
  ): Promise<void> {
    const created = await this.insertNotification({
      recipientUserId: payload.requesterUserId,
      eventType: 'ConnectionAccepted',
      aggregateId: payload.connectionId,
      type: 'ConnectionAccepted',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'Connection accepted',
      body: 'Your connection request was accepted',
      actionUrl: '/connections',
      aggregateIdJsonField: 'connectionId',
    });

    this.logger.debug(
      `ConnectionAccepted: ${created ? 'inserted' : 'skipped'} notification for requester=${payload.requesterUserId}`,
    );
  }

  processUserBlocked(payload: UserBlockedPayload): void {
    // Phase 5 stub: log only, no notification sent to blocked user
    this.logger.debug(
      `UserBlocked: blocker=${payload.blockerUserId}, blocked=${payload.blockedUserId} (Phase 5 stub — no notification)`,
    );
  }

  private async insertNotification(opts: {
    recipientUserId: string;
    eventType: string;
    aggregateId: string;
    type: string;
    payloadJson: Record<string, unknown>;
    title: string;
    body: string;
    actionUrl: string;
    /** JSON field name inside payloadJson whose value equals aggregateId —
     *  used to scope the dedup query to the specific aggregate instance
     *  (e.g. 'applicationId', 'noteId', 'seatId'). */
    aggregateIdJsonField?: string;
  }): Promise<boolean> {
    const key = `${opts.recipientUserId}:${opts.eventType}:${opts.aggregateId}`;

    // IdempotencyService.claim() catches P2002 internally and returns the
    // existing row — it never throws on duplicate.  We must guard the
    // notification insert ourselves so that an outbox replay never
    // produces a duplicate Notification row.
    await this.idempotencyService.claim('Notification', key);

    const where: Record<string, unknown> = {
      userId: opts.recipientUserId,
      type: opts.type,
    };

    // Scope the dedup lookup to the specific aggregate instance by matching
    // the aggregateId inside the JSON payload.  Without this, a notification
    // of type T for aggregate A would block all future T notifications for
    // the same user even when the aggregates differ.
    if (opts.aggregateIdJsonField && opts.aggregateId) {
      where.payloadJson = {
        path: [opts.aggregateIdJsonField],
        equals: opts.aggregateId,
      };
    }

    const existing = await this.prisma.notification.findFirst({
      where,
      select: { id: true },
    });

    if (existing) {
      this.logger.debug(`Skipping duplicate notification for key=${key}`);
      return false;
    }

    await this.prisma.notification.create({
      data: {
        userId: opts.recipientUserId,
        type: opts.type as Parameters<
          typeof this.prisma.notification.create
        >[0]['data']['type'],
        payloadJson: opts.payloadJson as Parameters<
          typeof this.prisma.notification.create
        >[0]['data']['payloadJson'],
        title: opts.title,
        body: opts.body,
        actionUrl: opts.actionUrl,
      },
    });
    return true;
  }
}
