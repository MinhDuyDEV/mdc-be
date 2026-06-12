import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma';
import { ApnsService } from './apns.service';
import { FcmService } from './fcm.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  failed: number;
}

/**
 * Unified push router that dispatches to FCM (Android) and APNs (iOS).
 * Batches by platform and cleans up invalid tokens automatically.
 */
@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
    private readonly apnsService: ApnsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PushService.name);
  }

  /**
   * Send a push notification to all devices registered to the given user.
   * Invalid tokens (410, BadDeviceToken, invalid-registration-token) are
   * automatically nullified so they are not retried.
   */
  async sendPush(
    userId: string,
    notification: PushNotificationPayload,
  ): Promise<PushResult> {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId, deviceToken: { not: null } },
    });

    if (devices.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    const androidTokens = devices
      .filter((d) => d.deviceType === 'android')
      .map((d) => d.deviceToken!)
      .filter(Boolean);

    const iosDevices = devices.filter((d) => d.deviceType === 'ios');
    const webDevices = devices.filter((d) => d.deviceType === 'web');

    // ----------------
    // Android via FCM
    // ----------------
    if (androidTokens.length > 0) {
      if (this.fcmService.isEnabled) {
        try {
          // FCM max 100 tokens per batch to avoid GOAWAY
          for (let i = 0; i < androidTokens.length; i += 100) {
            const batch = androidTokens.slice(i, i + 100);
            const result = await this.fcmService.sendMulticast(
              batch,
              { title: notification.title, body: notification.body },
              notification.data,
            );
            sent += result.successCount;
            failed += result.failureCount;

            result.responses.forEach((resp, idx) => {
              if (
                !resp.success &&
                resp.error?.code === 'messaging/invalid-registration-token'
              ) {
                invalidTokens.push(batch[idx]);
              }
            });
          }
        } catch (err) {
          this.logger.error('FCM send failed for user %s: %s', userId, err);
          failed += androidTokens.length;
        }
      } else {
        this.logger.debug(
          'FCM disabled — skipping %d Android device(s)',
          androidTokens.length,
        );
      }
    }

    // ----------------
    // iOS via APNs
    // ----------------
    if (iosDevices.length > 0) {
      if (this.apnsService.isEnabled) {
        for (const device of iosDevices) {
          try {
            const result = await this.apnsService.send(
              device.deviceToken!,
              { title: notification.title, body: notification.body },
              notification.data,
            );
            if (result.success) {
              sent++;
            } else {
              failed++;
              // BadDeviceToken or 410 = token invalid
              if (
                result.reason === 'BadDeviceToken' ||
                result.statusCode === 410
              ) {
                invalidTokens.push(device.deviceToken!);
              }
            }
          } catch (err) {
            this.logger.error(
              'APNs send failed for device %s: %s',
              device.id,
              err,
            );
            failed++;
          }
        }
      } else {
        this.logger.debug(
          'APNs disabled — skipping %d iOS device(s)',
          iosDevices.length,
        );
      }
    }

    // ----------------
    // Web via FCM (web push uses FCM under the hood)
    // ----------------
    if (webDevices.length > 0) {
      if (this.fcmService.isEnabled) {
        const webTokens = webDevices.map((d) => d.deviceToken!).filter(Boolean);
        try {
          for (let i = 0; i < webTokens.length; i += 100) {
            const batch = webTokens.slice(i, i + 100);
            const result = await this.fcmService.sendMulticast(
              batch,
              { title: notification.title, body: notification.body },
              notification.data,
            );
            sent += result.successCount;
            failed += result.failureCount;

            result.responses.forEach((resp, idx) => {
              if (
                !resp.success &&
                resp.error?.code === 'messaging/invalid-registration-token'
              ) {
                invalidTokens.push(batch[idx]);
              }
            });
          }
        } catch (err) {
          this.logger.error(
            'FCM send failed for web devices of user %s: %s',
            userId,
            err,
          );
          failed += webTokens.length;
        }
      } else {
        this.logger.debug(
          'FCM disabled — skipping %d web device(s)',
          webDevices.length,
        );
      }
    }

    // ----------------
    // Clean up invalid tokens
    // ----------------
    if (invalidTokens.length > 0) {
      await this.prisma.userDevice.updateMany({
        where: { deviceToken: { in: invalidTokens } },
        data: { deviceToken: null },
      });
      this.logger.warn(
        'Cleaned up %d invalid device token(s) for user %s',
        invalidTokens.length,
        userId,
      );
    }

    return { sent, failed };
  }
}
