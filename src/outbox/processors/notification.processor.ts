import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, type PinoLogger } from "nestjs-pino";
import type { PrismaService } from "../../infra/prisma/prisma.service";
import type { IdempotencyService } from "../idempotency.service";

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
				status: "active",
				role: { in: ["OWNER", "ADMIN"] },
			},
			select: { userId: true },
		}),
		prisma.recruiterSeat.findMany({
			where: {
				companyId,
				status: "allocated",
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
	constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
    @InjectPinoLogger(NotificationProcessor.name)
    private readonly logger: PinoLogger,
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
				eventType: "ApplicationSubmitted",
				aggregateId: payload.applicationId,
				type: "ApplicationSubmitted",
				payloadJson: payload as unknown as Record<string, unknown>,
				title: "New application",
				body: `A new application was submitted for job ${payload.jobId}`,
				actionUrl: `/applications/${payload.applicationId}`,
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

		if (payload.toStatus === "WITHDRAWN") {
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
				eventType: "ApplicationStatusChanged",
				aggregateId: payload.applicationId,
				type: "ApplicationStatusChanged",
				payloadJson: payload as unknown as Record<string, unknown>,
				title: "Application status updated",
				body: `Application status changed to ${payload.toStatus}`,
				actionUrl: `/applications/${payload.applicationId}`,
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
				eventType: "ApplicationNoteAdded",
				aggregateId: payload.noteId,
				type: "ApplicationNoteAdded",
				payloadJson: payload as unknown as Record<string, unknown>,
				title: "New note on application",
				body: `A note was added to application ${payload.applicationId}`,
				actionUrl: `/applications/${payload.applicationId}`,
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
				status: "allocated",
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
			eventType: "RecruiterSeatAllocated",
			aggregateId: seat.id,
			type: "RecruiterSeatAllocated",
			payloadJson: payload as unknown as Record<string, unknown>,
			title: "You were allocated a recruiter seat",
			body: `You have been granted a recruiter seat for company ${payload.companyId}`,
			actionUrl: `/companies/${payload.companyId}`,
		});

		this.logger.debug(
			`RecruiterSeatAllocated: ${created ? "inserted" : "skipped (duplicate)"} notification row for user=${payload.recruiterUserId}`,
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
	}): Promise<boolean> {
		const key = `${opts.recipientUserId}:${opts.eventType}:${opts.aggregateId}`;
		try {
			await this.idempotencyService.claim("Notification", key);
		} catch (err) {
			const isP2002 =
				typeof err === "object" &&
				err !== null &&
				"code" in err &&
				(err as Record<string, unknown>).code === "P2002";
			if (isP2002) return false;
			throw err;
		}

		await this.prisma.notification.create({
			data: {
				userId: opts.recipientUserId,
				type: opts.type as Parameters<
					typeof this.prisma.notification.create
				>[0]["data"]["type"],
				payloadJson: opts.payloadJson as Parameters<
					typeof this.prisma.notification.create
				>[0]["data"]["payloadJson"],
				title: opts.title,
				body: opts.body,
				actionUrl: opts.actionUrl,
			},
		});
		return true;
	}
}
