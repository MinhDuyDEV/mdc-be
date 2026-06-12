import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '../config';
import { ApnsService } from './apns.service';

const noopLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
} as unknown as PinoLogger;

describe('ApnsService', () => {
  const createMockConfig = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({
      get: jest.fn((key: string) => {
        const defaults: Record<string, unknown> = {
          apnsEnabled: false,
          apnsTeamId: '',
          apnsKeyId: '',
          apnsSigningKeyPath: '',
          apnsBundleId: '',
          apnsProduction: false,
        };
        return overrides[key] ?? defaults[key];
      }),
    }) as unknown as ConfigService<AppConfig, true>;

  describe('onModuleInit', () => {
    it('skips initialisation when apnsEnabled is false', () => {
      const config = createMockConfig({ apnsEnabled: false });
      const service = new ApnsService(config, noopLogger);
      service.onModuleInit();
      expect(service.isEnabled).toBe(false);
    });

    it('skips initialisation when apnsSigningKeyPath is empty', () => {
      const config = createMockConfig({
        apnsEnabled: true,
        apnsSigningKeyPath: '',
      });
      const service = new ApnsService(config, noopLogger);
      service.onModuleInit();
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('returns false when APNs is not initialised', () => {
      const config = createMockConfig({ apnsEnabled: false });
      const service = new ApnsService(config, noopLogger);
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('send', () => {
    it('throws when APNs is not initialised', async () => {
      const config = createMockConfig({ apnsEnabled: false });
      const service = new ApnsService(config, noopLogger);
      await expect(
        service.send('token', { title: 'Test', body: 'Test body' }),
      ).rejects.toThrow('APNs not initialised');
    });
  });

  describe('onModuleDestroy', () => {
    it('does not throw when client is null', () => {
      const config = createMockConfig({ apnsEnabled: false });
      const service = new ApnsService(config, noopLogger);
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
