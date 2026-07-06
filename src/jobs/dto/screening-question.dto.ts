import { ScreeningQuestionType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

/**
 * Validates the `options` array against the sibling `type` field:
 * - SINGLE_CHOICE / MULTI_CHOICE → options is required and must contain
 *   at least 2 distinct, non-empty entries (≤ 50).
 * - TEXT / BOOLEAN / NUMERIC → options must be omitted or empty.
 *
 * class-validator exposes sibling fields via `ValidationArguments.property`
 * lookups against the validated object, so we read `args.object['type']`.
 */
function IsValidScreeningOptions(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidScreeningOptions',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const obj = args.object as { type?: ScreeningQuestionType };
          const type = obj.type;
          const options = Array.isArray(value) ? (value as unknown[]) : null;

          if (type === ScreeningQuestionType.SINGLE_CHOICE) {
            if (!options || options.length < 2) return false;
            return options.every(
              (o) => typeof o === 'string' && o.trim() !== '',
            );
          }
          if (type === ScreeningQuestionType.MULTI_CHOICE) {
            if (!options || options.length < 2) return false;
            return options.every(
              (o) => typeof o === 'string' && o.trim() !== '',
            );
          }
          // TEXT / BOOLEAN / NUMERIC must not carry options.
          return !options || options.length === 0;
        },
        defaultMessage(args: ValidationArguments): string {
          const obj = args.object as { type?: ScreeningQuestionType };
          const type = obj.type;
          if (
            type === ScreeningQuestionType.SINGLE_CHOICE ||
            type === ScreeningQuestionType.MULTI_CHOICE
          ) {
            return 'options must contain at least 2 distinct non-empty strings';
          }
          return 'options is not allowed for this question type';
        },
      },
    });
  };
}

/**
 * Input shape used when creating/updating a Job's screening questions.
 * `id` is optional — present only on update to keep a stable identity.
 */
export class ScreeningQuestionInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question!: string;

  @IsEnum(ScreeningQuestionType)
  type!: ScreeningQuestionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsValidScreeningOptions()
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  position?: number;
}

/**
 * Public response shape for a screening question (returned on Job detail/list).
 */
export class ScreeningQuestionResponseDto {
  id!: string;
  question!: string;
  type!: ScreeningQuestionType;
  required!: boolean;
  options!: string[];
  position!: number;
}
