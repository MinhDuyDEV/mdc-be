import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DEFAULT_PAGE_LIMIT } from '../../common/pagination/cursor-pagination.dto';

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return DEFAULT_PAGE_LIMIT;
    }

    return Number(value);
  })
  @IsInt()
  @Min(1)
  limit: number = DEFAULT_PAGE_LIMIT;
}
