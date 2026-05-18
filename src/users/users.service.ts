import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(user: AuthenticatedUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        status: true,
        createdAt: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return profile;
  }

  async updateOwnProfile(user: AuthenticatedUser, data: { displayName?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: data.displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        status: true,
        createdAt: true,
      },
    });

    return updated;
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user || user.status === 'DELETED' || user.status === 'DISABLED') {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }
}
