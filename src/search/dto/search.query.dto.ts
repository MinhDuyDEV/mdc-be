import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SEARCH_ENTITY_TYPES = [
  'profiles',
  'companies',
  'jobs',
  'posts',
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export class SearchQueryDto {
  @IsString()
  @MaxLength(500)
  q!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @IsString({ each: true })
  @IsIn(SEARCH_ENTITY_TYPES, { each: true })
  type?: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SearchReindexQueryDto {
  @IsIn(SEARCH_ENTITY_TYPES)
  entityType!: SearchEntityType;
}
