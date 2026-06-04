import { Injectable } from '@nestjs/common';
import type { ReportEntityType } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

/**
 * Exhaustive entity-type dispatcher.
 *
 * Every `ReportEntityType` value MUST have a handler here; adding a new
 * enum value to the Prisma schema causes a **compile-time** error because
 * the `Record<ReportEntityType, …>` literal will miss the key.
 *
 * The old `switch` with `default: return false` silently accepted any
 * unknown type, making it impossible to detect when a handler was missing.
 */
@Injectable()
export class ModerationPolicyService {
  private readonly validators: Record<
    ReportEntityType,
    (id: string) => Promise<boolean>
  >;

  constructor(private readonly prisma: PrismaService) {
    this.validators = {
      POST: (id) => this.targetExists(this.prisma.post, id),
      COMMENT: (id) => this.targetExists(this.prisma.comment, id),
      MESSAGE: (id) => this.targetExists(this.prisma.message, id),
      PROFILE: (id) => this.targetExists(this.prisma.profile, id),
      COMPANY: (id) => this.targetExists(this.prisma.company, id),
      JOB: (id) => this.targetExists(this.prisma.job, id),
    };
  }

  async validateTargetExists(
    entityType: ReportEntityType,
    entityId: string,
  ): Promise<boolean> {
    return this.validators[entityType](entityId);
  }

  /**
   * Shared existence check for every entity type.
   */
  private async targetExists(
    delegate: {
      findUnique(args: {
        where: { id: string };
        select: { id: true };
      }): Promise<{ id: string } | null>;
    },
    id: string,
  ): Promise<boolean> {
    const record = await delegate.findUnique({
      where: { id },
      select: { id: true },
    });
    return record !== null;
  }
}
