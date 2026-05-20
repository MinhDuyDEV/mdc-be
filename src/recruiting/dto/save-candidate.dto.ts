import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SaveCandidateDto {
  @IsUUID()
  candidateUserId!: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AddCandidateToPoolDto {
  @IsUUID()
  candidateUserId!: string;
}

export class CreateCandidateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}
