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

  /**
   * Create an Elasticsearch index with mappings and settings.
   */
  async createIndex(
    index: string,
    mappings?: Record<string, unknown>,
    settings?: Record<string, unknown>,
  ): Promise<void> {
    await this.client.indices.create({
      index,
      ...(mappings ? { mappings } : {}),
      ...(settings ? { settings } : {}),
    });
  }

  /**
   * Update mappings for an existing index.
   */
  async putMapping(
    index: string,
    mappings: Record<string, unknown>,
  ): Promise<void> {
    await this.client.indices.putMapping({
      index,
      ...mappings,
    });
  }

  /**
   * Delete an index.
   */
  async deleteIndex(index: string): Promise<void> {
    await this.client.indices.delete({ index });
  }

  /**
   * Atomically update aliases (add/remove).
   */
  async updateAliases(actions: Array<Record<string, unknown>>): Promise<void> {
    await this.client.indices.updateAliases({
      body: { actions },
    });
  }

  /**
   * Bulk index documents from an iterable data source.
   */
  async bulkIndex<T extends Record<string, unknown>>(
    datasource: Array<{ id: string; body: T }>,
    options: { index: string },
  ): Promise<number> {
    const result = await this.client.helpers.bulk({
      datasource,
      onDocument(doc: { id: string; body: T }) {
        return [{ index: { _index: options.index, _id: doc.id } }, doc.body];
      },
      retries: 3,
    });
    return result.total ?? 0;
  }

  /**
   * Get document count for an index.
   */
  async getCount(
    index: string,
    query?: Record<string, unknown>,
  ): Promise<number> {
    const result = await this.client.count({
      index,
      ...(query ? { body: { query } } : {}),
    });
    return result.count;
  }

  /**
   * List all index names in the cluster.
   */
  async listIndices(): Promise<string[]> {
    const response = await this.client.cat.indices({ format: 'json' });
    return (response as Array<{ index: string }>).map((i) => i.index);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
