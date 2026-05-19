import { Industry } from "@prisma/client";
import {
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class CreateCompanyDto {
	@IsString()
	@MaxLength(200)
	name!: string;

	@IsOptional()
	@IsEnum(Industry)
	industry?: Industry;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsUrl()
	@MaxLength(500)
	website?: string;

	@IsOptional()
	@IsString()
	@MaxLength(50)
	employeeCount?: string;

	@IsOptional()
	@IsInt()
	@Min(1800)
	@Max(new Date().getFullYear())
	foundedYear?: number;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	headquarters?: string;
}
