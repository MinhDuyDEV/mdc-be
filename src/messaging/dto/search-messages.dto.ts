import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from '../../common/pagination/cursor-pagination.dto';

export class SearchMessagesDto extends CursorPaginationQueryDto {
  @IsString()
  @IsNotEmpty()
  q!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
