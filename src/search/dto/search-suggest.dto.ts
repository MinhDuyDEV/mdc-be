import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

export const SUGGEST_ENTITY_TYPES = [
  'profile',
  'company',
  'job',
  'post',
] as const;
export type SuggestEntityType = (typeof SUGGEST_ENTITY_TYPES)[number];

/**
 * Comma-separated allowlist validator: the value must be a string of
 * one or more entries from `SUGGEST_ENTITY_TYPES`, optionally separated
 * by commas (e.g. `"profile"`, `"profile,company"`).
 */
function IsCommaSeparatedEntityTypes(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsCommaSeparatedEntityTypes',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const segments = value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          return (
            segments.length > 0 &&
            segments.every((s) =>
              (SUGGEST_ENTITY_TYPES as readonly string[]).includes(s),
            )
          );
        },
        defaultMessage(): string {
          return `type must be a comma-separated list of: ${SUGGEST_ENTITY_TYPES.join(', ')}`;
        },
      },
    });
  };
}

export class SuggestQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsCommaSeparatedEntityTypes()
  type?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 10;
}

export interface SuggestHitDto {
  id: string;
  type: 'profile' | 'company' | 'job' | 'post';
  text: string;
  score: number;
}

export interface SuggestResponseDto {
  data: SuggestHitDto[];
  meta: {
    took: number;
  };
}
