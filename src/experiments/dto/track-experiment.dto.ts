import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class TrackExperimentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  experimentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  variant!: string;
}
