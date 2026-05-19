import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from "class-validator";

export class ScreeningAnswerDto {
	@IsString()
	@MaxLength(255)
	questionId!: string;

	@IsString()
	@MaxLength(2000)
	question!: string;

	@IsString()
	@MaxLength(10000)
	answer!: string;
}

export class SubmitApplicationDto {
	@IsOptional()
	@IsString()
	@MaxLength(20000)
	coverLetter?: string;

	@IsOptional()
	@IsArray()
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => ScreeningAnswerDto)
	screeningAnswers?: ScreeningAnswerDto[];

	@IsOptional()
	@IsUUID()
	resumeMediaAssetId?: string;
}
