import { Injectable, Logger } from '@nestjs/common';
import { PompelmiService } from '@pompelmi/nestjs';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../infra/prisma';

export interface VirusScanResult {
  clean: boolean;
  threats: string[];
  engine: 'pompelmi';
  scannedAt: Date;
}

type PompelmiVerdict =
  | { kind: 'clean' }
  | { kind: 'malicious'; threats: string[] }
  | { kind: 'error'; reason: string };

/** Default timeout for ClamAV scan (milliseconds). */
const DEFAULT_SCAN_TIMEOUT_MS = 30_000;

/**
 * Wraps the {@link PompelmiService} to produce a stable, project-local
 * scan result shape and persist the outcome to the {@link MediaAsset}
 * row. Infected files are quarantined by setting the asset's `status`
 * to `QUARANTINED`.
 */
@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly scanTimeoutMs: number;

  constructor(
    private readonly pompelmi: PompelmiService,
    private readonly prisma: PrismaService,
  ) {
    this.scanTimeoutMs = DEFAULT_SCAN_TIMEOUT_MS;
  }

  /**
   * Runs the virus scan on an in-memory buffer and returns the result.
   * The scan is bounded by a configurable timeout (default 30s, max 5min)
   * to prevent a stalled ClamAV daemon from hanging the outbox worker.
   *
   * Does NOT persist the result — call {@link persistScanResult} separately
   * (optionally inside a transaction) to write scan metadata to the DB.
   */
  async scanBuffer(buffer: Buffer): Promise<VirusScanResult> {
    const verdict = await this.runWithTimeout(buffer);
    return this.toResult(verdict);
  }

  /**
   * Persists the scan result to the MediaAsset record. When called with a
   * transaction (`tx`), the write is performed inside that transaction so
   * it is atomic with the caller's other writes (e.g., flipping the asset
   * to READY).
   */
  async persistScanResult(
    mediaAssetId: string,
    result: VirusScanResult,
    tx?: PrismaTransaction,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.mediaAsset.update({
      where: { id: mediaAssetId },
      data: {
        scanStatus: result.clean ? 'CLEAN' : 'INFECTED',
        scanResult: { threats: result.threats, engine: result.engine },
        scannedAt: result.scannedAt,
        ...(result.clean ? {} : { status: 'QUARANTINED' }),
      },
    });

    if (!result.clean) {
      this.logger.warn(
        `Media asset ${mediaAssetId} quarantined. Threats: ${result.threats.join(', ')}`,
      );
    }
  }

  /**
   * Runs the scan buffer with a timeout. If the scan exceeds the timeout,
   * the promise rejects with a TimeoutError so the caller can handle it
   * gracefully (e.g., mark as QUARANTINED with a SCAN_TIMEOUT threat).
   */
  private async runWithTimeout(buffer: Buffer): Promise<PompelmiVerdict> {
    const scanPromise = this.pompelmi.scanBuffer(
      buffer,
    ) as Promise<PompelmiVerdict>;

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Virus scan timed out after ${this.scanTimeoutMs}ms`));
      }, this.scanTimeoutMs);
    });

    return Promise.race([scanPromise, timeout]);
  }

  private toResult(verdict: PompelmiVerdict): VirusScanResult {
    const scannedAt = new Date();
    if (verdict.kind === 'clean') {
      return { clean: true, threats: [], engine: 'pompelmi', scannedAt };
    }
    if (verdict.kind === 'malicious') {
      return {
        clean: false,
        threats: verdict.threats,
        engine: 'pompelmi',
        scannedAt,
      };
    }
    return {
      clean: false,
      threats: [`SCAN_ERROR:${verdict.reason}`],
      engine: 'pompelmi',
      scannedAt,
    };
  }
}
