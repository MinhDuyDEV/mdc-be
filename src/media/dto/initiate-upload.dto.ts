import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class InitiateUploadDto {
	@IsIn(["avatar", "resume", "attachment"])
	purpose: string;

	@IsString()
	filename: string;

	@IsString()
	contentType: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	sizeBytes?: number;
}
