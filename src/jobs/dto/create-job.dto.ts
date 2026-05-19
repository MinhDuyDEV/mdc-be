import { ApplyMode, EmploymentType, WorkplaceType } from "@prisma/client";
import {
	IsArray,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUrl,
	IsUUID,
	Length,
	MaxLength,
	Min,
} from "class-validator";

export class CreateJobDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	title!: string;

	@IsString()
	@IsNotEmpty()
	description!: string;

	@IsUUID()
	companyId!: string;

	@IsEnum(ApplyMode)
	applyMode!: ApplyMode;

	@IsOptional()
	@IsUrl({ require_tld: false })
	@MaxLength(2048)
	applyUrl?: string;

	@IsEnum(EmploymentType)
	employmentType!: EmploymentType;

	@IsEnum(WorkplaceType)
	workplaceType!: WorkplaceType;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	location?: string;

	@IsOptional()
	@IsArray()
	@IsUUID("all", { each: true })
	skillIds?: string[];

	@IsOptional()
	@IsNumber()
	@Min(0)
	salaryMin?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	salaryMax?: number;

	@IsOptional()
	@IsString()
	@Length(3, 3)
	salaryCurrency?: string;
}
