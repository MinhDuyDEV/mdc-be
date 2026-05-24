import { IsUUID } from 'class-validator';

export class CreateRecruitingConversationDto {
  @IsUUID()
  candidateUserId!: string;
}
