import { EmploymentType, JobStatus, WorkplaceType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { CursorPaginationQueryDto } from "../../common/pagination/cursor-pagination.dto.js";

export class ListJobsQueryDto extends CursorPaginationQueryDto {
	@IsOptional()
	@IsUUID()
	companyId?: string;

	/**
	 * Ignored for anonymous callers — forced to PUBLISHED in the service.
	 */
	@IsOptional()
	@IsEnum(JobStatus)
	status?: JobStatus;

	@IsOptional()
	@IsEnum(EmploymentType)
	employmentType?: EmploymentType;

	@IsOptional()
	@IsEnum(WorkplaceType)
	workplaceType?: WorkplaceType;

	@IsOptional()
	@IsString()
	location?: string;

	@IsOptional()
	@IsUUID()
	skillId?: string;

	/**
	 * Full-text search query. When present the service drops into raw SQL
	 * using Postgres `to_tsquery` against the `search_vector` column.
	 */
	@IsOptional()
	@IsString()
	q?: string;
}
