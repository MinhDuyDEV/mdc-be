import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';
import type { AppConfig } from '../config/app-config';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let configGet: jest.Mock;

  const buildService = (config: Partial<AppConfig>) => {
    configGet = jest.fn(
      (key: string) => (config as Record<string, unknown>)[key],
    );
    return new FeatureFlagsService({
      get: configGet,
    } as unknown as ConfigService<AppConfig, true>);
  };

  describe('when Unleash is disabled', () => {
    beforeEach(() => {
      service = buildService({
        unleashEnabled: false,
        unleashUrl: 'http://localhost:4242/api',
        unleashApiToken: '',
        unleashAppName: 'mdc-be',
      });
    });

    it('isEnabled returns false', () => {
      expect(service.isEnabled('some-flag')).toBe(false);
    });

    it('isEnabled returns false with userId', () => {
      expect(service.isEnabled('some-flag', 'user-1')).toBe(false);
    });

    it('getVariant returns disabled variant', () => {
      const result = service.getVariant('some-flag', 'user-1');
      expect(result).toEqual({ name: 'disabled', enabled: false });
    });

    it('onModuleInit does not throw when disabled', async () => {
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('when Unleash is enabled but server unreachable', () => {
    beforeEach(() => {
      service = buildService({
        unleashEnabled: true,
        unleashUrl: 'http://127.0.0.1:1/api',
        unleashApiToken: '',
        unleashAppName: 'mdc-be-test',
      });
    });

    it('onModuleInit fails closed (catches error, leaves unleash null)', async () => {
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(service.isEnabled('any-flag')).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('does not throw when unleash is null', () => {
      service = buildService({
        unleashEnabled: false,
        unleashUrl: '',
        unleashApiToken: '',
        unleashAppName: 'mdc-be',
      });
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
