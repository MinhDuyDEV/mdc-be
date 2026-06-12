import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { RegisterDeviceDto } from './dto/device.dto';

/**
 * Public-facing device record. The internal `deviceToken` (a secret) is
 * intentionally excluded to prevent token leakage to clients.
 */
export interface DeviceListItem {
  id: string;
  userId: string;
  deviceType: string;
  lastSeenAt: Date;
  createdAt: Date;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register (or refresh) a device token for push notifications.
   * Uses upsert by userId + deviceToken to handle re-registration.
   */
  async register(userId: string, dto: RegisterDeviceDto) {
    // Check if this token already exists for this user
    const existing = await this.prisma.userDevice.findFirst({
      where: { userId, deviceToken: dto.deviceToken },
    });

    if (existing) {
      // Refresh the existing record
      return this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          deviceType: dto.deviceType,
          deviceToken: dto.deviceToken,
          lastSeenAt: new Date(),
        },
      });
    }

    // Create new device record
    return this.prisma.userDevice.create({
      data: {
        userId,
        deviceType: dto.deviceType,
        deviceToken: dto.deviceToken,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Unregister (delete) a device by ID, scoped to the current user.
   */
  async unregister(userId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.userDevice.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('DEVICE_NOT_FOUND');
    }

    await this.prisma.userDevice.delete({ where: { id: deviceId } });
  }

  /**
   * List all devices registered to a user. Returns a sanitised view —
   * `deviceToken` is omitted because it is a secret that can be used to
   * send push notifications to the user's device.
   */
  async list(userId: string): Promise<DeviceListItem[]> {
    const rows = await this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        userId: true,
        deviceType: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    return rows;
  }
}
