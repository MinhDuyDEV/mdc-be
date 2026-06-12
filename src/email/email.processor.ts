import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailStatus } from '@prisma/client';
import type { AppConfig } from '../infra/config';
import {
  MAILER_TRANSPORTER,
  type MailerTransporter,
} from '../infra/mailer/mailer.constants';
import { PrismaService } from '../infra/prisma/prisma.service';
import { EmailTrackingService } from './email-tracking.service';
import { EmailService } from './email.service';

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
    private readonly mailerService: MailerTransporter,
    private readonly emailService: EmailService,
    private readonly trackingService: EmailTrackingService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollPending(): Promise<void> {
    const deliveries = await this.prisma.$transaction(async (tx) => {
      const locked: Array<{ id: string }> = await tx.$queryRaw`
        SELECT id FROM email_deliveries
        WHERE status = 'PENDING'::"EmailStatus"
          AND attempts < 3
        ORDER BY created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `;

      if (locked.length === 0) return [];

      const rows = await tx.emailDelivery.findMany({
        where: { id: { in: locked.map((r) => r.id) } },
        orderBy: { createdAt: 'asc' },
      });

      // ── Batch user + consent lookups (avoids N+1) ──
      // We do these OUTSIDE the per-row loop — previously each of the
      // 50 rows triggered 2 sequential DB roundtrips (`user.findUnique`
      // + `emailConsent.findUnique`), so a 50-email batch was 100 queries.
      // Now: 1 query for all users, then 1 query for all consents.
      const uniqueRecipients = [...new Set(rows.map((r) => r.to))];
      const users =
        uniqueRecipients.length === 0
          ? []
          : await this.prisma.user.findMany({
              where: { email: { in: uniqueRecipients } },
              select: { id: true, email: true },
            });
      const userIdByEmail = new Map(users.map((u) => [u.email, u.id]));

      const consents: Array<{ userId: string; trackingConsent: boolean }> =
        users.length === 0
          ? []
          : await this.prisma.emailConsent.findMany({
              where: { userId: { in: users.map((u) => u.id) } },
              select: { userId: true, trackingConsent: true },
            });
      const trackingConsentByUserId = new Map(
        consents.map((c) => [c.userId, c.trackingConsent]),
      );

      // Process each email while holding the lock — prevents duplicate sends
      // on crash or retry between lock release and SMTP call.
      for (const delivery of rows) {
        const event: EmailSendEvent = {
          id: delivery.id,
          to: delivery.to,
          subject: delivery.subject,
          template: delivery.template,
          context: delivery.context as Record<string, unknown>,
        };

        try {
          let html = this.emailService.renderTemplate(
            event.template,
            event.context,
          );

          // ── Email tracking & unsubscribe ──
          const userId = userIdByEmail.get(delivery.to);
          let unsubscribeUrl: string | undefined;

          if (userId) {
            const hasConsent = trackingConsentByUserId.get(userId) ?? false;
            if (hasConsent) {
              html = this.trackingService.injectTrackingPixel(
                html,
                delivery.id,
              );
              html = this.trackingService.rewriteLinks(html, delivery.id);
            }

            // Always add unsubscribe link
            unsubscribeUrl = this.trackingService.getUnsubscribeUrl(userId);
            const unsubscribeHtml = `<p style="font-size:12px;color:#999;margin-top:30px"><a href="${unsubscribeUrl}" style="color:#999">Unsubscribe</a></p>`;

            if (html.includes('</body>')) {
              html = html.replace('</body>', `${unsubscribeHtml}</body>`);
            } else {
              html = html + unsubscribeHtml;
            }
          }
          // ── End tracking ──

          const from = this.configService.get('emailFrom', { infer: true });
          // RFC 8058 one-click unsubscribe header. The URL is the same
          // HMAC-signed token URL embedded in the email body; mail clients
          // that support List-Unsubscribe-Post will trigger unsubscribe
          // without requiring the user to open the email.
          const headers: Record<string, string> = unsubscribeUrl
            ? {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              }
            : {};

          await this.mailerService.sendMail({
            from,
            to: event.to,
            subject: event.subject,
            html,
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
          });

          await tx.emailDelivery.update({
            where: { id: delivery.id },
            data: {
              status: EmailStatus.SENT,
              sentAt: new Date(),
            },
          });

          this.logger.log(`Email sent: ${event.template} → ${event.to}`);
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          const newAttempts = delivery.attempts + 1;
          const isExhausted = newAttempts >= 3;

          await tx.emailDelivery.update({
            where: { id: delivery.id },
            data: {
              attempts: newAttempts,
              errorMessage: err.message,
              ...(isExhausted
                ? { status: EmailStatus.FAILED, failedAt: new Date() }
                : {}),
            },
          });

          this.logger.warn(
            `Email delivery failed (attempt ${newAttempts}/3): ${delivery.template} → ${delivery.to}: ${err.message}`,
          );
        }
      }

      return rows;
    });

    if (deliveries.length > 0) {
      this.logger.log(`Processed ${deliveries.length} pending emails`);
    }
  }

  async process(event: EmailSendEvent): Promise<void> {
    try {
      const html = this.emailService.renderTemplate(
        event.template,
        event.context,
      );

      const from = this.configService.get('emailFrom', { infer: true });
      await this.mailerService.sendMail({
        from,
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
