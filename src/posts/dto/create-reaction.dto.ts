import { ReactionType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateReactionDto {
  @IsEnum(ReactionType)
  type!: ReactionType;
}
