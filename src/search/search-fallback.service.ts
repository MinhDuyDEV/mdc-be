import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { SearchEngineService } from '../infra/search-engine/search-engine.service';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class SearchFallbackService {
  private circuitState: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly cooldownMs = 30_000; // 30 seconds

  constructor(
    private readonly searchEngine: SearchEngineService,
    @InjectPinoLogger(SearchFallbackService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Check if circuit is open (ES unavailable, use fallback)
   */
  isCircuitOpen(): boolean {
    if (this.circuitState === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.circuitState = 'HALF_OPEN';
        this.logger.info('Circuit breaker entering HALF_OPEN state');
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Record ES operation success
   */
  recordSuccess(): void {
    if (this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'CLOSED';
      this.logger.info('Circuit breaker CLOSED — ES recovered');
    }
    this.failureCount = 0;
  }

  /**
   * Record ES operation failure
   */
  recordFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      if (this.circuitState === 'CLOSED') {
        this.circuitState = 'OPEN';
        this.logger.error(
          { failureCount: this.failureCount, error },
          'Circuit breaker OPEN — falling back to Postgres FTS',
        );
      } else if (this.circuitState === 'HALF_OPEN') {
        this.circuitState = 'OPEN';
        this.logger.error(
          { failureCount: this.failureCount, error },
          'Circuit breaker re-OPENED from HALF_OPEN — probe failed',
        );
      }
    }
  }

  /**
   * Periodic health check to auto-recover circuit
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkClusterHealth(): Promise<void> {
    if (this.circuitState !== 'OPEN') return;

    try {
      const { status } = await this.searchEngine.checkClusterHealth();
      if (status === 'up') {
        this.circuitState = 'HALF_OPEN';
        this.failureCount = 0;
        this.logger.info('ES cluster recovered — circuit HALF_OPEN, probing');
      }
    } catch {
      this.logger.debug('ES still unavailable during health check');
    }
  }

  /**
   * Get current circuit state (for observability)
   */
  getState(): {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
