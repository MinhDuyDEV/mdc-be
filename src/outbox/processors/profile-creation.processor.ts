import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface UserRegisteredPayload {
  userId: string;
  email: string;
}

function isPrismaUniqueViolation(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class ProfileCreationProcessor {
  private readonly logger = new Logger(ProfileCreationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called by the main outbox processor when a UserRegistered event is encountered.
   */
  async processUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    // Filter out soft-deleted profiles (e.g. previously removed by
    // moderation) so we can re-create a fresh shell for the new user.
    // Without this filter, a soft-deleted row would be returned and
    // we'd incorrectly skip shell creation.
    const existing = await this.prisma.profile.findFirst({
      where: { userId: payload.userId, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      this.logger.debug(
        `Profile already exists for user ${payload.userId} — skipping shell creation`,
      );
      return;
    }

    try {
      const profile = await this.prisma.profile.create({
        data: { userId: payload.userId },
        select: { id: true },
      });
      this.logger.debug(
        `Created profile shell ${profile.id} for user ${payload.userId}`,
      );
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        this.logger.debug(
          `Profile shell for user ${payload.userId} already created concurrently — skipping`,
        );
        return;
      }
      throw error;
    }
  }
}
