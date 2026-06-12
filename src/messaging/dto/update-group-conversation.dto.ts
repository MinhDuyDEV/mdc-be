import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateGroupConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;
}
