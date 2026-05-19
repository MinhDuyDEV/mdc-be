import type {
	Application,
	ApplicationAnswer,
	ApplicationAttachment,
	ApplicationNote,
	ApplicationStatus,
	ApplicationStatusEvent,
} from "@prisma/client";

/**
 * Public Application response shape.
 *
 * IMPORTANT: ApplicationNote is NEVER included in candidate-facing responses.
 * Use `toApplicationResponseDto(application, { audience: 'candidate' })` to
 * enforce this; the function strips notes for that audience.
 */
export class ApplicationResponseDto {
	id!: string;
	jobId!: string;
	userId!: string;
	status!: ApplicationStatus;
	coverLetter!: string | null;
	resumeMediaAssetId!: string | null;
	submittedAt!: Date;
	updatedAt!: Date;
	withdrawnAt!: Date | null;
	answers!: Array<{
		id: string;
		questionId: string;
		question: string;
		answer: string;
	}>;
	attachments!: Array<{ id: string; mediaAssetId: string; kind: string }>;
	statusEvents!: Array<{
		id: string;
		fromStatus: ApplicationStatus | null;
		toStatus: ApplicationStatus;
		changedByUserId: string;
		reason: string | null;
		createdAt: Date;
	}>;
	/**
	 * Notes are present ONLY when the audience is 'employer'. For 'candidate'
	 * audience this field is absent (undefined). Use `audience` to control.
	 */
	notes?: Array<{
		id: string;
		authorUserId: string;
		content: string;
		createdAt: Date;
		updatedAt: Date;
	}>;
}

export type ApplicationAudience = "candidate" | "employer";

type ApplicationWithRelations = Application & {
	answers: ApplicationAnswer[];
	attachments: ApplicationAttachment[];
	statusEvents: ApplicationStatusEvent[];
	notes?: ApplicationNote[];
};

export function toApplicationResponseDto(
	app: ApplicationWithRelations,
	options: { audience: ApplicationAudience },
): ApplicationResponseDto {
	const dto: ApplicationResponseDto = {
		id: app.id,
		jobId: app.jobId,
		userId: app.userId,
		status: app.status,
		coverLetter: app.coverLetter ?? null,
		resumeMediaAssetId: app.resumeMediaAssetId ?? null,
		submittedAt: app.submittedAt,
		updatedAt: app.updatedAt,
		withdrawnAt: app.withdrawnAt ?? null,
		answers: app.answers.map((a) => ({
			id: a.id,
			questionId: a.questionId,
			question: a.question,
			answer: a.answer,
		})),
		attachments: app.attachments.map((a) => ({
			id: a.id,
			mediaAssetId: a.mediaAssetId,
			kind: a.kind,
		})),
		statusEvents: app.statusEvents.map((e) => ({
			id: e.id,
			fromStatus: e.fromStatus ?? null,
			toStatus: e.toStatus,
			changedByUserId: e.changedByUserId,
			reason: e.reason ?? null,
			createdAt: e.createdAt,
		})),
	};

	if (options.audience === "employer" && app.notes) {
		dto.notes = app.notes
			.filter((n) => n.deletedAt === null)
			.map((n) => ({
				id: n.id,
				authorUserId: n.authorUserId,
				content: n.content,
				createdAt: n.createdAt,
				updatedAt: n.updatedAt,
			}));
	}

	return dto;
}
