import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { SearchService } from './search.service';
import { SearchIndexService } from './search-index.service';

@Module({
  imports: [InfraModule],
  providers: [SearchService, SearchIndexService],
  exports: [SearchService, SearchIndexService],
})
export class SearchModule {}
