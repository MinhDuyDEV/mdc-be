import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Unleash, startUnleash } from 'unleash-client';
import type { AppConfig } from '../config/app-config';

export interface VariantResult {
  name: string;
  enabled: boolean;
  payload?: Record<string, unknown>;
}

@Injectable()
export class FeatureFlagsService implements OnModuleInit, OnModuleDestroy {
  private unleash: Unleash | null = null;
  private readonly enabled: boolean;
  private readonly url: string;
  private readonly apiToken: string;
  private readonly appName: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.enabled = config.get('unleashEnabled', { infer: true });
    this.url = config.get('unleashUrl', { infer: true });
    this.apiToken = config.get('unleashApiToken', { infer: true });
    this.appName = config.get('unleashAppName', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    try {
      const customHeaders: Record<string, string> = {};
      if (this.apiToken) {
        customHeaders.Authorization = this.apiToken;
      }
      this.unleash = await startUnleash({
        url: this.url,
        appName: this.appName,
        ...(Object.keys(customHeaders).length > 0 ? { customHeaders } : {}),
      });
    } catch (error) {
      // Fail-closed: if Unleash server is unreachable, the service stays
      // disabled and `isEnabled()` returns false. Surface a loud warning so
      // operators notice the misconfiguration.

      console.warn(
        `[FeatureFlagsService] Unleash init failed, staying disabled: ${String(error)}`,
      );
      this.unleash = null;
    }
  }

  onModuleDestroy(): void {
    this.unleash?.destroy();
  }

  isEnabled(flagName: string, userId?: string): boolean {
    if (!this.unleash) return false;
    const context = userId ? { userId } : undefined;
    return this.unleash.isEnabled(flagName, context);
  }

  getVariant(flagName: string, userId: string): VariantResult {
    if (!this.unleash) return { name: 'disabled', enabled: false };
    const variant = this.unleash.getVariant(flagName, { userId });
    return {
      name: variant.name,
      enabled: variant.enabled,
      ...(variant.payload
        ? { payload: variant.payload as unknown as Record<string, unknown> }
        : {}),
    };
  }
}
