import { IsUUID } from 'class-validator';

export class ConversationJoinDto {
  @IsUUID()
  conversationId!: string;
}
