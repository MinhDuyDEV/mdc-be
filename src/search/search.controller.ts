import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	Request,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { SearchQueryDto } from "./dto/search.query.dto";
import type { SearchResponseDto } from "./dto/search.response.dto";
import type { SearchIndexService } from "./search-index.service";
import type { SearchQueryService } from "./search-query.service";

@Controller("search")
export class SearchController {
	constructor(
		private readonly searchQuery: SearchQueryService,
		private readonly searchIndex: SearchIndexService,
	) {}

	/**
	 * Unified search across all entity types
	 * GET /api/v1/search?q=engineer&type=jobs,profiles&limit=20
	 */
	@Get()
	async search(
		@Query() query: SearchQueryDto,
		@Request() req: any,
	): Promise<SearchResponseDto> {
		const userId = req.user?.id;
		return this.searchQuery.search(query, userId);
	}

	/**
	 * Search profiles only
	 * GET /api/v1/search/users?q=react developer
	 */
	@Get("users")
	async searchUsers(
		@Query() query: SearchQueryDto,
		@Request() req: any,
	): Promise<SearchResponseDto> {
		const userId = req.user?.id;
		return this.searchQuery.search({ ...query, type: ["profiles"] }, userId);
	}

	/**
	 * Search companies only
	 * GET /api/v1/search/companies?q=tech startup
	 */
	@Get("companies")
	async searchCompanies(
		@Query() query: SearchQueryDto,
		@Request() req: any,
	): Promise<SearchResponseDto> {
		const userId = req.user?.id;
		return this.searchQuery.search({ ...query, type: ["companies"] }, userId);
	}

	/**
	 * Search jobs only
	 * GET /api/v1/search/jobs?q=senior engineer
	 */
	@Get("jobs")
	async searchJobs(
		@Query() query: SearchQueryDto,
		@Request() req: any,
	): Promise<SearchResponseDto> {
		const userId = req.user?.id;
		return this.searchQuery.search({ ...query, type: ["jobs"] }, userId);
	}

	/**
	 * Search posts only
	 * GET /api/v1/search/posts?q=machine learning
	 */
	@Get("posts")
	async searchPosts(
		@Query() query: SearchQueryDto,
		@Request() req: any,
	): Promise<SearchResponseDto> {
		const userId = req.user?.id;
		return this.searchQuery.search({ ...query, type: ["posts"] }, userId);
	}

	/**
	 * Admin-only: Trigger reindex for an entity type
	 * POST /api/v1/search/reindex?entityType=jobs
	 */
	@Post("reindex")
	@UseGuards(AuthGuard, RolesGuard)
	@Roles("admin")
	@HttpCode(HttpStatus.ACCEPTED)
	async reindex(
		@Query('entityType')
    entityType: 'profiles' | 'companies' | 'jobs' | 'posts',
		@Request() req: any,
	): Promise<{ message: string; runId: string }> {
		const userId = req.user.id;
		const runId = await this.searchIndex.reindexEntity(entityType, userId);
		return {
			message: `Reindex started for ${entityType}`,
			runId,
		};
	}
}
