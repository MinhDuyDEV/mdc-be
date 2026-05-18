import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { EmailService } from './email.service';
import { MAILER_TRANSPORTER } from '../infra/mailer/mailer.constants';

export interface EmailSendEvent {
  id?: string;
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER_TRANSPORTER)
    private readonly mailerService: {
      sendMail: (options: any) => Promise<any>;
    },
    private readonly emailService: EmailService,
  ) {}

  async process(event: EmailSendEvent): Promise<void> {
    try {
      const html = this.emailService.renderTemplate(
        event.template,
        event.context,
      );

      await this.mailerService.sendMail({
        to: event.to,
        subject: event.subject,
        html,
      });

      if (event.id) {
        await this.prisma.emailDelivery.update({
          where: { id: event.id },
          data: {
            status: EmailStatus.SENT,
            sentAt: new Date(),
          },
        });
      }

      this.logger.log(`Email sent: ${event.template} → ${event.to}`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Email failed: ${event.template} → ${event.to}`,
        err.stack,
      );
      throw error;
    }
  }
}
