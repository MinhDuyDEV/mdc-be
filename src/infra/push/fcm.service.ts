import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  cert,
  deleteApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';

/** Stable name so test fixtures and prod both reference the same FCM app. */
const FCM_APP_NAME = 'mdc-fcm';
import {
  getMessaging,
  type BatchResponse,
  type Messaging,
} from 'firebase-admin/messaging';
import type { AppConfig } from '../config';

/**
 * FCM service — wraps Firebase Cloud Messaging for push delivery.
 * Initialises only when `fcmEnabled` is true.
 */
@Injectable()
export class FcmService implements OnModuleInit, OnModuleDestroy {
  private messaging: Messaging | null = null;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FcmService.name);
  }

  onModuleInit(): void {
    if (!this.config.get('fcmEnabled', { infer: true })) {
      this.logger.info('FCM disabled — skipping initialisation');
      return;
    }

    const serviceAccountPath = this.config.get('fcmServiceAccountPath', {
      infer: true,
    });
    if (!serviceAccountPath) {
      this.logger.warn(
        'FCM enabled but fcmServiceAccountPath is empty — skipping initialisation',
      );
      return;
    }

    try {
      // Use a named app so tests can reference the exact same instance via
      // `getApp(FCM_APP_NAME)`, and so multiple FCM credentials in the
      // same process (future-proofing) don't collide.
      const existing = getApps().find((a) => a.name === FCM_APP_NAME);
      const app: App =
        existing ??
        initializeApp({ credential: cert(serviceAccountPath) }, FCM_APP_NAME);
      this.messaging = getMessaging(app);
      this.logger.info('FCM initialised');
    } catch (err) {
      this.logger.error({ err }, 'Failed to initialise FCM');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.messaging) {
      try {
        await deleteApp(this.messaging.app);
      } catch (err) {
        this.logger.warn({ err }, 'FCM app delete failed during shutdown');
      }
      this.messaging = null;
    }
  }

  get isEnabled(): boolean {
    return this.messaging !== null;
  }

  /**
   * Send a multicast push notification to a batch of device tokens.
   * Max 100 tokens per call to avoid GOAWAY issues.
   */
  async sendMulticast(
    tokens: string[],
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<BatchResponse> {
    if (!this.messaging) {
      throw new Error('FCM not initialised');
    }

    return this.messaging.sendEachForMulticast({
      tokens,
      notification,
      data,
    });
  }
}
