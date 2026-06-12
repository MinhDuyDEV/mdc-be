import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { readFileSync } from 'node:fs';
import { ApnsClient, Host, Notification } from 'apns2';
import type { AppConfig } from '../config';

/**
 * APNs service — wraps the apns2 client for iOS push delivery.
 * Initialises only when `apnsEnabled` is true.
 */
@Injectable()
export class ApnsService implements OnModuleInit, OnModuleDestroy {
  private client: ApnsClient | null = null;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ApnsService.name);
  }

  onModuleInit(): void {
    if (!this.config.get('apnsEnabled', { infer: true })) {
      this.logger.info('APNs disabled — skipping initialisation');
      return;
    }

    const teamId = this.config.get('apnsTeamId', { infer: true });
    const keyId = this.config.get('apnsKeyId', { infer: true });
    const signingKeyPath = this.config.get('apnsSigningKeyPath', {
      infer: true,
    });
    const bundleId = this.config.get('apnsBundleId', { infer: true });
    const production = this.config.get('apnsProduction', { infer: true });

    if (!signingKeyPath) {
      this.logger.warn(
        'APNs enabled but apnsSigningKeyPath is empty — skipping initialisation',
      );
      return;
    }

    try {
      const signingKey = readFileSync(signingKeyPath, 'utf8');
      this.client = new ApnsClient({
        team: teamId,
        keyId: keyId,
        signingKey,
        defaultTopic: bundleId,
        host: production ? Host.production : Host.development,
      });
      this.logger.info('APNs initialised');
    } catch (err) {
      this.logger.error({ err }, 'Failed to initialise APNs');
    }
  }

  onModuleDestroy(): void {
    // apns2 client has no documented destroy; null out the reference so
    // any pending HTTP/2 connection can be GC'd.
    this.client = null;
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Send a push notification to a single iOS device.
   * Returns true on success, false on failure.
   */
  async send(
    deviceToken: string,
    payload: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<{ success: boolean; reason?: string; statusCode?: number }> {
    if (!this.client) {
      throw new Error('APNs not initialised');
    }

    try {
      const notification = new Notification(deviceToken, {
        alert: { title: payload.title, body: payload.body },
        sound: 'default',
        data,
      });
      await this.client.send(notification);
      return { success: true };
    } catch (err: unknown) {
      const apnsError = err as {
        statusCode?: number;
        reason?: string;
        message?: string;
      };
      return {
        success: false,
        reason: apnsError.reason ?? apnsError.message ?? 'Unknown APNs error',
        statusCode: apnsError.statusCode,
      };
    }
  }
}
