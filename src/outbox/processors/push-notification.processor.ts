import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PushService } from '../../infra/push/push.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface PushNotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Processor for PushNotificationRequired outbox events.
 * Checks notification preference before dispatching the push.
 */
@Injectable()
export class PushNotificationProcessor {
  /** Maps notification types to preference fields. */
  private readonly preferenceMap: Record<string, string> = {
    new_message: 'newMessage',
    connection_request: 'connectionRequest',
    connection_accepted: 'connectionAccepted',
    application_status_change: 'applicationStatusChange',
    job_recommendation: 'jobRecommendation',
    post_interaction: 'postInteraction',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PushNotificationProcessor.name);
  }

  /**
   * Process a push notification for the given user.
   * Respects the user's notification preferences.
   */
  async process(payload: PushNotificationPayload): Promise<void> {
    const { userId, type, title, body, data } = payload;

    // Check notification preference for this type
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // No preferences record → default all categories to enabled.
      this.logger.debug(
        { userId },
        'No preferences found for user — sending push (default)',
      );
    } else {
      // Check per-type preference
      const prefField = this.preferenceMap[type];
      if (prefField) {
        const typeEnabled = (prefs as unknown as Record<string, unknown>)[
          prefField
        ];
        if (typeEnabled === false) {
          this.logger.debug(
            { userId, prefField },
            'Preference disabled for user — skipping push',
          );
          return;
        }
      }
    }

    await this.pushService.sendPush(userId, { title, body, data });
    this.logger.debug({ userId, type }, 'Push notification sent');
  }
}
