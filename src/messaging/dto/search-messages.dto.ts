import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CursorPaginationQueryDto } from '../../common/pagination/cursor-pagination.dto';

export class SearchMessagesDto extends CursorPaginationQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q!: string;

  @IsOptional()
  @IsUUID('4')
  conversationId?: string;
}
