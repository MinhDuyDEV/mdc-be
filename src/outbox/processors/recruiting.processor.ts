import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../idempotency.service';

interface InterviewScheduledPayload {
  interviewId: string;
  applicationId: string;
  companyId: string;
  scheduledAt: string;
  scheduledByUserId: string;
}

interface InterviewCompletedPayload {
  interviewId: string;
  applicationId: string;
  companyId: string;
}

interface ScorecardSubmittedPayload {
  scorecardId: string;
  interviewId: string;
  applicationId: string;
  companyId: string;
  submittedByUserId: string;
}

interface OfferSentPayload {
  offerId: string;
  applicationId: string;
  companyId: string;
}

interface OfferRespondedPayload {
  offerId: string;
  applicationId: string;
  companyId: string;
  accepted: boolean;
}

/**
 * Handles recruiting domain outbox events: interview scheduling,
 * interview completion, scorecard submission, offer sent, and offer response.
 * Creates in-app notifications for the relevant users.
 */
@Injectable()
export class RecruitingProcessor {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async processInterviewScheduled(
    payload: InterviewScheduledPayload,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { userId: true },
    });
    if (!application) return;

    await this.insertNotification({
      recipientUserId: application.userId,
      eventType: 'InterviewScheduled',
      aggregateId: payload.interviewId,
      type: 'InterviewScheduled',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'Interview scheduled',
      body: 'An interview has been scheduled for your application',
      actionUrl: `/applications/${payload.applicationId}`,
    });
  }

  async processInterviewCompleted(
    payload: InterviewCompletedPayload,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { userId: true },
    });
    if (!application) return;

    await this.insertNotification({
      recipientUserId: application.userId,
      eventType: 'InterviewCompleted',
      aggregateId: payload.interviewId,
      type: 'InterviewCompleted',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'Interview completed',
      body: 'Your interview has been marked as completed',
      actionUrl: `/applications/${payload.applicationId}`,
    });
  }

  async processScorecardSubmitted(
    payload: ScorecardSubmittedPayload,
  ): Promise<void> {
    // Notify the recruiter who scheduled the interview
    const interview = await this.prisma.interview.findUnique({
      where: { id: payload.interviewId },
      select: { id: true },
    });
    if (!interview) return;

    await this.insertNotification({
      recipientUserId: payload.submittedByUserId,
      eventType: 'ScorecardSubmitted',
      aggregateId: payload.scorecardId,
      type: 'ScorecardSubmitted',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'Scorecard submitted',
      body: 'A scorecard has been submitted for an interview',
      actionUrl: `/companies/${payload.companyId}/scorecards`,
    });
  }

  async processOfferSent(payload: OfferSentPayload): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { userId: true },
    });
    if (!application) return;

    await this.insertNotification({
      recipientUserId: application.userId,
      eventType: 'OfferSent',
      aggregateId: payload.offerId,
      type: 'OfferReceived',
      payloadJson: payload as unknown as Record<string, unknown>,
      title: 'New offer',
      body: 'You have received a new job offer',
      actionUrl: `/offers/${payload.offerId}`,
    });
  }

  processOfferResponded(payload: OfferRespondedPayload): void {
    // Log for now — company notification fan-out is deferred
    // Future: find company members and notify them
    void payload.accepted;
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
  }): Promise<boolean> {
    const key = `${opts.recipientUserId}:${opts.eventType}:${opts.aggregateId}`;

    try {
      await this.idempotencyService.claim('Notification', key);
    } catch {
      // Duplicate notification — skip
      return false;
    }

    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: opts.recipientUserId,
        type: opts.type as never,
        payloadJson: {
          path: ['aggregateId'],
          equals: opts.aggregateId,
        },
      },
      select: { id: true },
    });

    if (existing) return false;

    await this.prisma.notification.create({
      data: {
        userId: opts.recipientUserId,
        type: opts.type as never,
        payloadJson: opts.payloadJson as never,
        title: opts.title,
        body: opts.body,
        actionUrl: opts.actionUrl,
      },
    });

    return true;
  }
}
