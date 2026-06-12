import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const DEVICE_TYPES = ['ios', 'android', 'web'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/**
 * deviceToken charset allowlist.
 *
 * APNS tokens are 64 hex chars, FCM tokens are ~163 base64url chars, and
 * web-push endpoints are HTTPS URLs. We accept the union of those three
 * safe charsets and reject anything with whitespace, control chars, or
 * shell metacharacters that could be smuggled into logs/queries.
 */
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_\-=:./]+$/;

export class RegisterDeviceDto {
  @IsIn(DEVICE_TYPES)
  deviceType!: DeviceType;

  @IsString()
  @MinLength(8, { message: 'deviceToken too short' })
  @MaxLength(512, { message: 'deviceToken too long' })
  @Matches(DEVICE_TOKEN_PATTERN, {
    message: 'deviceToken contains invalid characters',
  })
  deviceToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export interface DeviceResponseDto {
  id: string;
  userId: string;
  deviceType: DeviceType;
  deviceToken: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}
