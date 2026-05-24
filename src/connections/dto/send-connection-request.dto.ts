import { IsUUID } from 'class-validator';

export class SendConnectionRequestDto {
  @IsUUID()
  toUserId!: string;
}
