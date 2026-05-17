import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { SEARCH_ENGINE_CLIENT } from './search-engine.constants';
import type { SearchEngineClient } from './search-engine.provider';

@Injectable()
export class SearchEngineService implements OnApplicationShutdown {
  constructor(
    @Inject(SEARCH_ENGINE_CLIENT) private readonly client: SearchEngineClient,
  ) {}

  async checkClusterHealth(): Promise<{
    status: 'up' | 'down';
    message?: string;
  }> {
    try {
      const response = await this.client.cluster.health();
      const clusterStatus = response.status;
      if (clusterStatus === 'red') {
        return {
          status: 'down',
          message: `Elasticsearch cluster status is ${clusterStatus}`,
        };
      }
      return {
        status: 'up',
        message: `Elasticsearch cluster status is ${clusterStatus}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'down', message };
    }
  }

  async index(
    index: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    await this.client.index({ index, id, body });
  }

  async search(
    index: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.client.search({ index, body: query });
    return response;
  }

  async deleteByQuery(
    index: string,
    query: Record<string, unknown>,
  ): Promise<void> {
    await this.client.deleteByQuery({ index, body: query });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
