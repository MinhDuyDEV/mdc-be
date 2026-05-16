import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { RedisHealthService } from '../redis';

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
  ) {}

  live(): HealthResponse {
    return {
      status: 'ok',
      checks: {
        api: { status: 'up' },
      },
    };
  }

  async ready(): Promise<HealthResponse> {
    const checks: HealthResponse['checks'] = {};
    let status: HealthResponse['status'] = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
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
