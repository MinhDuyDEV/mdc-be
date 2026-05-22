import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkLimit(companyId: string, featureKey: string): Promise<boolean> {
    const entitlement = await this.prisma.companyEntitlement.findFirst({
      where: {
        companyId,
        entitlementType: featureKey,
        validUntil: { gte: new Date() },
      },
    });

    if (!entitlement) return false;
    return entitlement.creditsRemaining > 0;
  }

  async consumeCredit(
    companyId: string,
    entitlementType: string,
    amount: number,
    referenceType?: string,
    referenceId?: string,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.companyEntitlement.findFirst({
        where: {
          companyId,
          entitlementType,
          validUntil: { gte: new Date() },
        },
      });

      if (!entitlement) {
        throw new ForbiddenException('ENTITLEMENT_NOT_FOUND');
      }

      // Atomic decrement with optimistic concurrency
      const updated = await tx.companyEntitlement.updateMany({
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
      const refreshed = await tx.companyEntitlement.findUniqueOrThrow({
        where: { id: entitlement.id },
      });

      // Record transaction
      await tx.creditTransaction.create({
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
    });
  }
}
