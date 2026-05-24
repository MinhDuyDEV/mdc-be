import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import type { AppConfig } from '../config';

type PrismaClientOptions = NonNullable<
  ConstructorParameters<typeof PrismaClient>[0]
>;
type PrismaTransactionOptions = NonNullable<
  PrismaClientOptions['transactionOptions']
>;

const DEFAULT_TRANSACTION_MAX_WAIT_MS = 5000;
const DEFAULT_TRANSACTION_TIMEOUT_MS = 15000;

function resolveTransactionOptions(
  configService?: ConfigService<AppConfig, true>,
): PrismaTransactionOptions {
  return {
    maxWait:
      configService?.get('prismaTransactionMaxWaitMs', { infer: true }) ??
      DEFAULT_TRANSACTION_MAX_WAIT_MS,
    timeout:
      configService?.get('prismaTransactionTimeoutMs', { infer: true }) ??
      DEFAULT_TRANSACTION_TIMEOUT_MS,
  };
}

/**
 * Type helper that describes the transactional client passed to
 * `withTransaction` callbacks.
 */

export type PrismaTransaction = Prisma.TransactionClient;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly transactionOptions: PrismaTransactionOptions;

  constructor(@Optional() configService?: ConfigService<AppConfig, true>) {
    const transactionOptions = resolveTransactionOptions(configService);
    super({ transactionOptions });
    this.transactionOptions = transactionOptions;
  }

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
    return this.$transaction(fn, this.transactionOptions);
  }
}
