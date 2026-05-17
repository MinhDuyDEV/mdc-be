import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import { SEARCH_ENGINE_CLIENT } from './search-engine.constants';
import type { SearchEngineClient } from './search-engine.provider';

@Injectable()
export class SearchEngineHealthService implements OnApplicationShutdown {
  constructor(
    @Inject(SEARCH_ENGINE_CLIENT) private readonly client: SearchEngineClient,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async ping(): Promise<void> {
    const timeoutMs = this.configService.get('healthElasticsearchTimeoutMs', {
      infer: true,
    });
    const result = await this.withTimeout(async () => {
      const response = await this.client.cluster.health();
      const status = response.status;
      if (status === 'red') {
        throw new Error(`Elasticsearch cluster status is ${status}`);
      }
    }, timeoutMs);
    return result;
  }

  private async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Elasticsearch health check timed out')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
