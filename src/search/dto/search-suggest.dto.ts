import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SuggestQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @IsString()
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
