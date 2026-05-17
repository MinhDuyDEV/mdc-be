import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Type helper that describes the transactional client passed to
 * `withTransaction` callbacks.  It mirrors `PrismaService` but strips
 * the `$` lifecycle methods that are unavailable inside interactive
 * transactions.
 */

export type PrismaTransaction = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Execute work inside a Prisma interactive transaction.
   *
   * The callback receives a `PrismaTransaction` client whose operations are
   * automatically enrolled in the same database transaction.  If the callback
   * resolves, the transaction commits; if it throws, the transaction rolls
   * back.
   *
   * @example
   * ```ts
   * await this.prisma.withTransaction(async (tx) => {
   *   await tx.user.create({ data: { ... } });
   *   await tx.auditLog.create({ data: { ... } });
   * });
   * ```
   */
  async withTransaction<T>(
    fn: (tx: PrismaTransaction) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn);
  }
}
