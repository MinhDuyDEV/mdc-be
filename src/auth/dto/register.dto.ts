import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^\w[\w-]{0,29}$/, {
    message:
      'handle must start with a letter/underscore and contain only letters, numbers, hyphens, and underscores',
  })
  handle?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;
}
