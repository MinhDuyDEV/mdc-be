import { IsEnum, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from '../../common/pagination/cursor-pagination.dto';

export enum FeedSortOrder {
  RANKED = 'ranked',
  LATEST = 'latest',
}

export class FeedQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(FeedSortOrder)
  sort?: FeedSortOrder;
}
