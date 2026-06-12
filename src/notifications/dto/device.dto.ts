import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const DEVICE_TYPES = ['ios', 'android', 'web'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export class RegisterDeviceDto {
  @IsIn(DEVICE_TYPES)
  deviceType!: DeviceType;

  @IsString()
  @IsNotEmpty()
  deviceToken!: string;

  @IsOptional()
  @IsString()
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
