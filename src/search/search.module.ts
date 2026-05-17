import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchIndexService } from "./search-index.service";

@Module({
	providers: [SearchService, SearchIndexService],
	exports: [SearchService, SearchIndexService],
})
export class SearchModule {}
