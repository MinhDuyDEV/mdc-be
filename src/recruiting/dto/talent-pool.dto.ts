import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateTalentPoolDto {
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	name!: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	description?: string;
}

export class UpdateTalentPoolDto {
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	description?: string;
}
