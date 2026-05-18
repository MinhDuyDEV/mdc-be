import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  displayName!: string | null;

  @Expose()
  emailVerifiedAt!: Date | null;

  @Expose()
  status!: string;

  @Expose()
  createdAt!: Date;
}
