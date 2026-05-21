import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InfraModule } from '../infra';
import { SearchService } from './search.service';
import { SearchFallbackService } from './search-fallback.service';
import { SearchIndexService } from './search-index.service';

@Module({
  imports: [InfraModule, ScheduleModule],
  providers: [SearchService, SearchIndexService, SearchFallbackService],
  exports: [SearchService, SearchIndexService, SearchFallbackService],
})
export class SearchModule {}
