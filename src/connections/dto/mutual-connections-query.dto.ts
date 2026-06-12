import { IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from '../../common/pagination/cursor-pagination.dto';

export class MutualConnectionsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
