import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, type PinoLogger } from "nestjs-pino";
import type { PrismaService } from "../../infra/prisma/prisma.service";

interface ApplicationStatusChangedPayload {
	applicationId: string;
	toStatus: string;
	fromStatus?: string;
}

@Injectable()
export class ApplicationEmailProcessor {
	constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(ApplicationEmailProcessor.name)
    private readonly logger: PinoLogger,
  ) {}

	async processApplicationStatusChanged(
		payload: ApplicationStatusChangedPayload,
	): Promise<void> {
		const application = await this.prisma.application.findUnique({
			where: { id: payload.applicationId },
			include: {
				user: true,
				job: {
					include: { company: true },
				},
			},
		});

		if (!application) {
			this.logger.warn(
				"Application %s not found for ApplicationStatusChanged email — skipping",
				payload.applicationId,
			);
			return;
		}

		const delivery = await this.prisma.emailDelivery.create({
			data: {
				to: application.user.email,
				subject: `Your application to ${application.job.title} is ${payload.toStatus.toLowerCase()}`,
				template: "application-status-changed",
				context: {
					candidateName:
						(application.user as { displayName?: string | null }).displayName ??
						application.user.email,
					jobTitle: application.job.title,
					companyName: application.job.company.name,
					toStatus: payload.toStatus,
					fromStatus: payload.fromStatus ?? null,
				},
			},
		});

		this.logger.debug(
			"ApplicationStatusChanged email delivery created id=%s for application=%s",
			delivery.id,
			payload.applicationId,
		);
	}
}
