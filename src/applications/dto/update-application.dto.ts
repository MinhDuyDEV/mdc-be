import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Candidate-only edit of a submitted application (pre-terminal statuses only).
 *
 * - `coverLetter`: replace the cover letter text.
 * - `resumeMediaAssetId`: swap the attached resume to a different media asset
 *   owned by the caller (`purpose='resume'`, `status='READY'`). Omit to keep
 *   the current resume. To remove a resume entirely, withdraw and re-apply.
 */
export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  coverLetter?: string;

  @IsOptional()
  @IsUUID()
  resumeMediaAssetId?: string;
}
