import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type {
  AdminUserQueryDto,
  UpdateUserStatusDto,
  VerifyCompanyDto,
} from './dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listUsers(query: AdminUserQueryDto) {
    const users = await this.prisma.user.findMany({
      where: {
        status: query.status,
        OR: query.search
          ? [
              { email: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return { data: users, meta: { hasNextPage: users.length === 50 } };
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    adminId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: dto.status },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.user.status_change',
          entityType: 'User',
          entityId: userId,
          metadata: { newStatus: dto.status, reason: dto.reason },
        },
      });

      if (dto.status === UserStatus.SUSPENDED) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
  }

  async listCompanies(query: { search?: string }) {
    const companies = await this.prisma.company.findMany({
      where: query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : undefined,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return { data: companies, meta: { hasNextPage: companies.length === 50 } };
  }

  async verifyCompany(
    companyId: string,
    dto: VerifyCompanyDto,
    adminId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Lookup existing verification record
      const verification = await tx.companyVerification.findFirst({
        where: { companyId },
      });

      if (verification) {
        await tx.companyVerification.update({
          where: { id: verification.id },
          data: {
            status: 'VERIFIED',
            reviewedByUserId: adminId,
            reviewedAt: new Date(),
            notes: dto.notes,
          },
        });
      } else {
        // Create a new verification record if none exists
        await tx.companyVerification.create({
          data: {
            companyId,
            requestedByUserId: adminId,
            status: 'VERIFIED',
            reviewedByUserId: adminId,
            reviewedAt: new Date(),
            notes: dto.notes,
            documentUrls: [],
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.company.verify',
          entityType: 'Company',
          entityId: companyId,
          metadata: { notes: dto.notes },
        },
      });
    });
  }

  async listJobs(query: { companyId?: string }) {
    const jobs = await this.prisma.job.findMany({
      where: query.companyId ? { companyId: query.companyId } : undefined,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return { data: jobs, meta: { hasNextPage: jobs.length === 50 } };
  }
}
