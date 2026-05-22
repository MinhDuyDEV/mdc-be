import { Injectable } from '@nestjs/common';
import type { ReportEntityType } from '@prisma/client';
import type { PrismaService } from '../infra/prisma/prisma.service';

@Injectable()
export class ModerationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async validateTargetExists(
    entityType: ReportEntityType,
    entityId: string,
  ): Promise<boolean> {
    switch (entityType) {
      case 'POST':
        return !!(await this.prisma.post.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
      case 'COMMENT':
        return !!(await this.prisma.comment.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
      case 'MESSAGE':
        return !!(await this.prisma.message.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
      case 'PROFILE':
        return !!(await this.prisma.profile.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
      case 'COMPANY':
        return !!(await this.prisma.company.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
      case 'JOB':
        return !!(await this.prisma.job.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
      default:
        return false;
    }
  }
}
