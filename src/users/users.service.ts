import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminRole, type CompanyRole } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';

export interface CompanyMembershipDto {
  companyId: string;
  companyName: string;
  companySlug: string;
  role: CompanyRole;
}

export interface RecruiterSeatDto {
  seatId: string;
  companyId: string;
}

export interface OwnProfileResponse {
  id: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
  status: string;
  createdAt: Date;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  adminPermissions: string[];
  companyMemberships: CompanyMembershipDto[];
  /**
   * Allocated recruiter seats. Lets the frontend render employer-only UI for
   * `MEMBER` company members who hold a seat (membership role alone is not
   * sufficient for employer permissions — a seat is required).
   */
  recruiterSeats: RecruiterSeatDto[];
}

const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 3,
  [AdminRole.ADMIN]: 2,
  [AdminRole.MODERATOR]: 1,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(user: AuthenticatedUser): Promise<OwnProfileResponse> {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        status: true,
        createdAt: true,
        adminUser: {
          select: {
            role: true,
            permissions: { select: { permission: true } },
          },
        },
        companyMembers: {
          where: { status: 'active' },
          select: {
            role: true,
            company: { select: { id: true, name: true, slug: true } },
          },
        },
        recruiterSeats: {
          where: { status: 'allocated' },
          select: { id: true, companyId: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const { adminUser, companyMembers, recruiterSeats, ...rest } = profile;
    const adminRank = adminUser ? (ADMIN_ROLE_RANK[adminUser.role] ?? 0) : 0;

    return {
      ...rest,
      isSuperAdmin: adminRank >= ADMIN_ROLE_RANK.SUPER_ADMIN,
      isAdmin: adminRank >= ADMIN_ROLE_RANK.ADMIN,
      isModerator: adminRank >= ADMIN_ROLE_RANK.MODERATOR,
      adminPermissions: adminUser?.permissions.map((p) => p.permission) ?? [],
      companyMemberships: companyMembers.map((m) => ({
        companyId: m.company.id,
        companyName: m.company.name,
        companySlug: m.company.slug,
        role: m.role,
      })),
      recruiterSeats: recruiterSeats.map((s) => ({
        seatId: s.id,
        companyId: s.companyId,
      })),
    };
  }

  async updateOwnProfile(
    user: AuthenticatedUser,
    data: { displayName?: string },
  ) {
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
}
