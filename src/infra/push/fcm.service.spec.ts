import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '../config';
import { FcmService } from './fcm.service';

const noopLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
} as unknown as PinoLogger;

describe('FcmService', () => {
  const createMockConfig = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({
      get: jest.fn((key: string) => {
        const defaults: Record<string, unknown> = {
          fcmEnabled: false,
          fcmServiceAccountPath: '',
        };
        return overrides[key] ?? defaults[key];
      }),
    }) as unknown as ConfigService<AppConfig, true>;

  describe('onModuleInit', () => {
    it('skips initialisation when fcmEnabled is false', () => {
      const config = createMockConfig({ fcmEnabled: false });
      const service = new FcmService(config, noopLogger);
      service.onModuleInit();
      expect(service.isEnabled).toBe(false);
    });

    it('skips initialisation when fcmServiceAccountPath is empty', () => {
      const config = createMockConfig({
        fcmEnabled: true,
        fcmServiceAccountPath: '',
      });
      const service = new FcmService(config, noopLogger);
      service.onModuleInit();
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('returns false when FCM is not initialised', () => {
      const config = createMockConfig({ fcmEnabled: false });
      const service = new FcmService(config, noopLogger);
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('sendMulticast', () => {
    it('throws when FCM is not initialised', async () => {
      const config = createMockConfig({ fcmEnabled: false });
      const service = new FcmService(config, noopLogger);
      await expect(
        service.sendMulticast(['token'], { title: 'Test', body: 'Test body' }),
      ).rejects.toThrow('FCM not initialised');
    });
  });

  describe('onModuleDestroy', () => {
    it('does not throw when messaging is null', () => {
      const config = createMockConfig({ fcmEnabled: false });
      const service = new FcmService(config, noopLogger);
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
