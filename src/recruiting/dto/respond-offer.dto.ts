import { IsBoolean, IsNotEmpty } from 'class-validator';

export class RespondOfferDto {
  @IsBoolean()
  @IsNotEmpty()
  accepted!: boolean;
}
