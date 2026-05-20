import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface ApplicationStatusChangedPayload {
  applicationId: string;
  toStatus: string;
  fromStatus?: string;
}

@Injectable()
export class ApplicationEmailProcessor {
  private readonly logger = new Logger(ApplicationEmailProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async processApplicationStatusChanged(
    payload: ApplicationStatusChangedPayload,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      include: {
        user: true,
        job: { include: { company: true } },
      },
    });

    if (!application) {
      this.logger.warn(
        `Application ${payload.applicationId} not found for ApplicationStatusChanged email — skipping`,
      );
      return;
    }

    const delivery = await this.prisma.emailDelivery.create({
      data: {
        to: application.user.email,
        subject: `Your application to ${application.job.title} is ${payload.toStatus.toLowerCase()}`,
        template: 'application-status-changed',
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
      `ApplicationStatusChanged email delivery created id=${delivery.id} for application=${payload.applicationId}`,
    );
  }
}
