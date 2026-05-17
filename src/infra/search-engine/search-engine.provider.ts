import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import { SEARCH_ENGINE_CLIENT } from './search-engine.constants';

export type SearchEngineClient = Client;

export const searchEngineProvider = {
  provide: SEARCH_ENGINE_CLIENT,
  inject: [ConfigService],
  useFactory: (
    configService: ConfigService<AppConfig, true>,
  ): SearchEngineClient => {
    const elasticsearchNode = configService.get('elasticsearchNode', {
      infer: true,
    });
    const nodeEnv = configService.get('nodeEnv', { infer: true });
    return new Client({
      node: elasticsearchNode,
      tls: {
        rejectUnauthorized: nodeEnv === 'production',
      },
    });
  },
};
