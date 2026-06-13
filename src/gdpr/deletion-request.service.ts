import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../infra/prisma/prisma.service';

export type DeletionRequestStatus =
  | 'PENDING_ERASURE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

@Injectable()
export class DeletionRequestService {
  constructor(private readonly prisma: PrismaService) {}

  // FSM: PENDING_ERASURE -> IN_PROGRESS -> COMPLETED | CANCELLED | FAILED
  async createDeletionRequest(
    userId: string,
    requestedBy: string,
    reason?: string,
  ) {
    // Check if there's already a pending request
    const existing = await this.prisma.deletionRequest.findFirst({
      where: {
        userId,
        status: {
          in: ['PENDING_ERASURE', 'IN_PROGRESS'],
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'User already has a pending deletion request',
      );
    }

    const gracePeriodDays = 7; // configurable via env
    const slaDays = 30;
    const now = new Date();
    const scheduledFor = new Date(
      now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000,
    );
    const dueBy = new Date(now.getTime() + slaDays * 24 * 60 * 60 * 1000);

    return this.prisma.deletionRequest.create({
      data: {
        userId,
        requestedBy,
        reason,
        status: 'PENDING_ERASURE',
        scheduledFor,
        dueBy,
      },
    });
  }

  async updateStatus(requestId: string, status: DeletionRequestStatus) {
    const request = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Deletion request not found');

    // FSM validation
    const validTransitions: Record<string, string[]> = {
      PENDING_ERASURE: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'FAILED'],
      COMPLETED: [],
      CANCELLED: [],
      FAILED: ['IN_PROGRESS'], // allow retry
    };
    if (!validTransitions[request.status]?.includes(status)) {
      throw new BadRequestException(
        `Invalid transition from ${request.status} to ${status}`,
      );
    }

    return this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
      },
    });
  }

  async cancelRequest(requestId: string, userId: string) {
    const request = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Deletion request not found');
    if (request.userId !== userId)
      throw new ForbiddenException("Cannot cancel another user's request");
    if (request.status !== 'PENDING_ERASURE') {
      throw new BadRequestException(
        `Cannot cancel request in status ${request.status}`,
      );
    }
    return this.updateStatus(requestId, 'CANCELLED');
  }

  async findById(id: string) {
    return this.prisma.deletionRequest.findUnique({ where: { id } });
  }

  async findOverdueRequests() {
    return this.prisma.deletionRequest.findMany({
      where: {
        dueBy: { lt: new Date() },
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
      },
    });
  }
}
