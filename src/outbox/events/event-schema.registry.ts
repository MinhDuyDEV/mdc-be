import type { Prisma } from '@prisma/client';
import { z } from 'zod';

const payload = z.object({}).passthrough();
const stringArray = z.array(z.string());

export const outboxEventSchemas = {
  ApplicationNoteAdded: payload.extend({
    applicationId: z.string(),
    noteId: z.string(),
    authorUserId: z.string(),
    companyId: z.string(),
  }),
  ApplicationStatusChanged: payload.extend({
    applicationId: z.string(),
    fromStatus: z.string().optional(),
    toStatus: z.string(),
    companyId: z.string(),
    candidateUserId: z.string(),
    changedByUserId: z.string().optional(),
    reason: z.string().nullable().optional(),
  }),
  ApplicationSubmitted: payload.extend({
    applicationId: z.string(),
    jobId: z.string(),
    companyId: z.string(),
    candidateUserId: z.string(),
  }),
  CandidateAddedToTalentPool: payload.extend({
    talentPoolCandidateId: z.string(),
    talentPoolId: z.string(),
    companyId: z.string(),
    candidateUserId: z.string(),
  }),
  CandidateSaved: payload.extend({
    savedCandidateId: z.string(),
    companyId: z.string(),
    candidateUserId: z.string(),
    savedByUserId: z.string(),
  }),
  CommentAdded: payload.extend({
    commentId: z.string(),
    postId: z.string(),
    authorId: z.string(),
    parentId: z.string().optional(),
  }),
  CompanyCreated: payload.extend({
    companyId: z.string(),
    name: z.string().optional(),
    slug: z.string().optional(),
    creatorUserId: z.string().optional(),
  }),
  CompanyFollowed: payload.extend({
    companyId: z.string(),
    userId: z.string(),
  }),
  CompanyMemberAdded: payload.extend({
    companyId: z.string(),
    userId: z.string(),
    role: z.string(),
    addedBy: z.string(),
  }),
  CompanyMemberRemoved: payload.extend({
    companyId: z.string(),
    memberId: z.string(),
    userId: z.string(),
    previousRole: z.string(),
    removedBy: z.string(),
  }),
  CompanyMemberRoleChanged: payload.extend({
    companyId: z.string(),
    memberId: z.string(),
    userId: z.string(),
    previousRole: z.string(),
    newRole: z.string(),
    changedBy: z.string(),
  }),
  CompanyUnfollowed: payload.extend({
    companyId: z.string(),
    userId: z.string(),
  }),
  CompanyUpdated: payload.extend({
    companyId: z.string(),
    previousName: z.string().optional(),
    newName: z.string().optional(),
  }),
  ConnectionAccepted: payload.extend({
    connectionId: z.string(),
    requesterUserId: z.string(),
    targetUserId: z.string(),
  }),
  ConnectionRequested: payload.extend({
    connectionId: z.string(),
    requesterUserId: z.string(),
    targetUserId: z.string(),
  }),
  ConversationCreated: payload.extend({
    conversationId: z.string(),
    participantIds: stringArray,
  }),
  ExternalApplyClicked: payload.extend({
    jobId: z.string(),
    companyId: z.string(),
    userId: z.string().nullable(),
    occurredAt: z.string(),
  }),
  InterviewScheduled: payload.extend({
    interviewId: z.string(),
    applicationId: z.string(),
    companyId: z.string(),
    scheduledAt: z.string(),
    scheduledByUserId: z.string(),
  }),
  InterviewCompleted: payload.extend({
    interviewId: z.string(),
    applicationId: z.string(),
    companyId: z.string(),
  }),
  ScorecardSubmitted: payload.extend({
    scorecardId: z.string(),
    interviewId: z.string(),
    applicationId: z.string(),
    companyId: z.string(),
    submittedByUserId: z.string(),
  }),
  OfferSent: payload.extend({
    offerId: z.string(),
    applicationId: z.string(),
    companyId: z.string(),
  }),
  OfferResponded: payload.extend({
    offerId: z.string(),
    applicationId: z.string(),
    companyId: z.string(),
    accepted: z.boolean(),
  }),
  JobClosed: payload.extend({
    jobId: z.string(),
    companyId: z.string(),
  }),
  JobCreated: payload.extend({
    jobId: z.string(),
    companyId: z.string(),
    createdByUserId: z.string(),
  }),
  JobDeleted: payload.extend({
    jobId: z.string(),
    companyId: z.string(),
  }),
  JobPublished: payload.extend({
    jobId: z.string(),
    companyId: z.string(),
  }),
  JobUpdated: payload.extend({
    jobId: z.string(),
    companyId: z.string(),
    changes: z.unknown(),
  }),
  MediaAssetCompleted: payload.extend({
    mediaId: z.string(),
    ownerId: z.string(),
    purpose: z.string(),
    contentType: z.string(),
    sizeBytes: z.number(),
  }),
  MediaAssetDeleted: payload.extend({
    mediaId: z.string(),
    ownerId: z.string(),
    purpose: z.string(),
    s3Key: z.string(),
    s3Bucket: z.string(),
  }),
  MemberInvited: payload.extend({
    companyId: z.string(),
    invitationId: z.string(),
    email: z.string(),
    role: z.string(),
    invitedBy: z.string(),
  }),
  MemberJoined: payload.extend({
    companyId: z.string(),
    userId: z.string(),
    role: z.string(),
    invitationId: z.string(),
  }),
  MentionCreated: payload.extend({
    postId: z.string(),
    mentionedUserId: z.string(),
    mentionerUserId: z.string(),
  }),
  MentionRemoved: payload.extend({
    postId: z.string(),
    mentionId: z.string(),
    mentionedUserId: z.string(),
    mentionerUserId: z.string(),
  }),
  MessageEdited: payload.extend({
    messageId: z.string(),
    conversationId: z.string(),
    editorId: z.string(),
  }),
  MessageDeleted: payload.extend({
    messageId: z.string(),
    conversationId: z.string(),
    deleterId: z.string(),
  }),
  MessageSent: payload.extend({
    messageId: z.string(),
    conversationId: z.string(),
    senderId: z.string(),
    recipientIds: stringArray,
  }),
  PaymentProviderEventReceived: payload.extend({
    eventId: z.string(),
    provider: z.string(),
    eventType: z.string(),
  }),
  PostCreated: payload.extend({
    postId: z.string(),
    authorId: z.string(),
    visibility: z.string(),
  }),
  PostContentChanged: payload.extend({
    postId: z.string(),
    authorId: z.string(),
  }),
  PostDeleted: payload.extend({
    postId: z.string(),
    authorId: z.string(),
  }),
  PostUpdated: payload.extend({
    postId: z.string(),
    authorId: z.string(),
  }),
  ShareCreated: payload.extend({
    postId: z.string(),
    sharedPostId: z.string(),
    authorId: z.string(),
    originalAuthorId: z.string(),
  }),
  ProfileUpdated: payload.extend({
    profileId: z.string(),
    userId: z.string(),
  }),
  ReactionAdded: payload.extend({
    reactionId: z.string(),
    postId: z.string(),
    authorId: z.string(),
    type: z.string(),
  }),
  ReactionRemoved: payload.extend({
    reactionId: z.string(),
    postId: z.string(),
    authorId: z.string(),
    type: z.string(),
  }),
  RecruiterSeatAllocated: payload.extend({
    companyId: z.string(),
    seatId: z.string(),
    recruiterUserId: z.string(),
    allocatedBy: z.string(),
  }),
  RecruiterSeatDeallocated: payload.extend({
    companyId: z.string(),
    seatId: z.string(),
    userId: z.string(),
    deallocatedBy: z.string(),
  }),
  ReportCreated: payload.extend({
    reportId: z.string(),
    targetEntity: z.string(),
    targetId: z.string(),
  }),
  ProfileRemoved: payload.extend({
    profileId: z.string(),
    userId: z.string(),
  }),
  CompanyRemoved: payload.extend({
    companyId: z.string(),
  }),
  MessageRemoved: payload.extend({
    messageId: z.string(),
    conversationId: z.string(),
  }),
  SubscriptionCancelled: payload.extend({
    subscriptionId: z.string(),
    companyId: z.string(),
  }),
  SubscriptionCreated: payload.extend({
    subscriptionId: z.string(),
    companyId: z.string(),
    planId: z.string(),
  }),
  UserBlocked: payload.extend({
    blockerUserId: z.string(),
    blockedUserId: z.string(),
  }),
  UserStatusChanged: payload.extend({
    userId: z.string(),
    previousStatus: z.string(),
    newStatus: z.string(),
    changedBy: z.string(),
    reason: z.string().nullable().optional(),
  }),
  UserLoggedIn: payload.extend({
    userId: z.string(),
    email: z.string(),
    loginAt: z.string(),
  }),
  UserRegistered: payload.extend({
    userId: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  ExperimentImpression: payload.extend({
    experimentId: z.string(),
    userId: z.string(),
    variant: z.string(),
    timestamp: z.string(),
  }),
  PushNotificationRequired: payload.extend({
    userId: z.string(),
    type: z.string(),
    title: z.string(),
    body: z.string(),
    data: z.record(z.string(), z.string()).optional(),
  }),
  MediaAssetVirusScanned: payload.extend({
    mediaAssetId: z.string(),
    ownerId: z.string(),
    clean: z.boolean(),
    threats: z.array(z.string()).optional(),
  }),
  MediaAssetThumbnailsGenerated: payload.extend({
    mediaAssetId: z.string(),
    ownerId: z.string(),
    sizes: z.array(z.object({ width: z.number(), s3Key: z.string() })),
  }),
} as const;

export type OutboxEventType = keyof typeof outboxEventSchemas;

export function isOutboxEventType(
  eventType: string,
): eventType is OutboxEventType {
  return eventType in outboxEventSchemas;
}

export function validateOutboxPayload(
  eventType: string,
  payloadValue: unknown,
): Prisma.InputJsonValue {
  if (!isOutboxEventType(eventType)) {
    throw new Error(`Unknown outbox event type: ${eventType}`);
  }

  const result = outboxEventSchemas[eventType].safeParse(payloadValue);
  if (!result.success) {
    throw new Error(
      `Invalid outbox payload for ${eventType}: ${result.error.message}`,
    );
  }

  return result.data as Prisma.InputJsonValue;
}
