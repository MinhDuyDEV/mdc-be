import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface UserRegisteredPayload {
  userId: string;
  email: string;
}

@Injectable()
export class ProfileCreationProcessor {
  private readonly logger = new Logger(ProfileCreationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Polls for UserRegistered events and creates profile shells.
   * Idempotent — skips if profile already exists for the user.
   */
  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'profile-creation-processor',
    waitForCompletion: true,
  })
  handleUserRegistered(): void {
    // In future: this will be called by the main OutboxProcessor dispatching to handlers
    // For now, it's a standalone cron that checks for unprocessed UserRegistered events
    this.logger.debug(
      'Profile creation processor tick (no-op in current phase)',
    );
  }

  /**
   * Called by the main outbox processor when a UserRegistered event is encountered.
   */
  processUserRegistered(_payload: UserRegisteredPayload): void {
    void _payload;
    // TODO(mdc-be-dwe): Implement in future phase
    // 1. Check if profile already exists for userId
    // 2. If not, create profile shell via prisma.profile.create()
  }
}
