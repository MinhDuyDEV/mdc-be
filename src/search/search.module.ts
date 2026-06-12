import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InfraModule } from '../infra';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchFallbackService } from './search-fallback.service';
import { SearchIndexService } from './search-index.service';
import { SearchQueryService } from './search-query.service';
import { SearchSuggestService } from './search-suggest.service';

@Module({
  imports: [InfraModule, ScheduleModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchIndexService,
    SearchFallbackService,
    SearchQueryService,
    SearchSuggestService,
  ],
  exports: [
    SearchService,
    SearchIndexService,
    SearchFallbackService,
    SearchQueryService,
    SearchSuggestService,
  ],
})
export class SearchModule {}
