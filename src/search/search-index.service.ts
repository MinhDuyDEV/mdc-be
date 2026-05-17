import { Injectable } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import type { SearchEngineService } from '../infra/search-engine';

/**
 * Elasticsearch indexing facade consumed by outbox processors
 * in later phases. Domain modules call index/delete/search here
 * instead of importing the Elasticsearch SDK directly.
 */
@Injectable()
export class SearchIndexService {
  constructor(
    private readonly searchEngine: SearchEngineService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SearchIndexService.name);
  }

  /**
   * Index a document in Elasticsearch.
   * Falls back gracefully: logs a warning if ES is unavailable.
   */
  async indexDocument(
    index: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.searchEngine.index(index, id, body);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `SearchIndexService: failed to index document ${id} in ${index}: ${message}`,
      );
    }
  }

  /**
   * Remove documents matching a query.
   */
  async deleteByQuery(
    index: string,
    query: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.searchEngine.deleteByQuery(index, query);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `SearchIndexService: failed to delete from ${index}: ${message}`,
      );
    }
  }

  /**
   * Search documents in Elasticsearch.
   */
  async search(
    index: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.searchEngine.search(index, query);
  }
}
