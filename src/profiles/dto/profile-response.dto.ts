import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ProfileResponseDto {
  @Expose()
  id!: string;

  @Expose()
  userId!: string;

  @Expose()
  headline!: string | null;

  @Expose()
  about!: string | null;

  @Expose()
  location!: string | null;

  @Expose()
  website!: string | null;

  @Expose()
  openToWork!: boolean;

  @Expose()
  recruitingEligible!: boolean;

  @Expose()
  visibility!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
