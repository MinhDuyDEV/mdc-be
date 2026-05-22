import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Alias for the interactive-transaction client Prisma passes to
 * `$transaction` callbacks.  This is the raw Prisma API without
 * NestJS lifecycle methods.
 */
type TxClient = Prisma.TransactionClient;

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkLimit(companyId: string, featureKey: string): Promise<boolean> {
    const now = new Date();
    const entitlement = await this.prisma.companyEntitlement.findFirst({
      where: {
        companyId,
        entitlementType: featureKey,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });

    if (!entitlement) return false;
    return entitlement.creditsRemaining > 0;
  }

  /**
   * Consume credits from a company entitlement atomically.
   *
   * When `tx` is provided the operation is enrolled in the caller's
   * transaction (e.g. publishJob) so credit decrement and the paired
   * business operation commit or roll back together.
   */
  async consumeCredit(
    companyId: string,
    entitlementType: string,
    amount: number,
    referenceType?: string,
    referenceId?: string,
    tx?: TxClient,
  ): Promise<number> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer');
    }

    const run = async (c: TxClient): Promise<number> => {
      const now = new Date();
      const entitlement = await c.companyEntitlement.findFirst({
        where: {
          companyId,
          entitlementType,
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
      });

      if (!entitlement) {
        throw new ForbiddenException('ENTITLEMENT_NOT_FOUND');
      }

      // Atomic decrement with optimistic concurrency
      const updated = await c.companyEntitlement.updateMany({
        where: {
          id: entitlement.id,
          creditsRemaining: { gte: amount },
        },
        data: {
          creditsUsed: { increment: amount },
          creditsRemaining: { decrement: amount },
        },
      });

      if (updated.count === 0) {
        throw new ForbiddenException('ENTITLEMENT_EXCEEDED');
      }

      // Re-read to get accurate balanceAfter (avoid stale read under concurrency)
      const refreshed = await c.companyEntitlement.findUniqueOrThrow({
        where: { id: entitlement.id },
      });

      // Record transaction
      await c.creditTransaction.create({
        data: {
          entitlementId: entitlement.id,
          companyId,
          amount: -amount,
          balanceAfter: refreshed.creditsRemaining,
          referenceType,
          referenceId,
        },
      });

      return refreshed.creditsRemaining;
    };

    if (tx) {
      return run(tx);
    }

    return this.prisma.$transaction(async (innerTx) => run(innerTx));
  }
}
