import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { RedisHealthService } from '../redis';
import { type AppConfig } from '../config';

export interface HealthDependencyStatus {
  status: 'up' | 'down';
}

export interface HealthResponse {
  status: 'ok' | 'error';
  checks: {
    api?: HealthDependencyStatus;
    postgres?: HealthDependencyStatus;
    redis?: HealthDependencyStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealthService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  live(): HealthResponse {
    return {
      status: 'ok',
      checks: {
        api: { status: 'up' },
      },
    };
  }

  private async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Health check timed out')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  async ready(): Promise<HealthResponse> {
    const checks: HealthResponse['checks'] = {};
    let status: HealthResponse['status'] = 'ok';

    try {
      await this.withTimeout(
        () => this.prisma.$queryRaw`SELECT 1`,
        this.configService.get('healthDatabaseTimeoutMs', { infer: true }),
      );
      checks.postgres = { status: 'up' };
    } catch {
      checks.postgres = { status: 'down' };
      status = 'error';
    }

    try {
      await this.redisHealth.ping();
      checks.redis = { status: 'up' };
    } catch {
      checks.redis = { status: 'down' };
      status = 'error';
    }

    return { status, checks };
  }
}
