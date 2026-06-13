import { Injectable, Logger } from '@nestjs/common';
import { PompelmiService } from '@pompelmi/nestjs';
import type { PrismaService } from '../infra/prisma/prisma.service';

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

/**
 * Wraps the {@link PompelmiService} to produce a stable, project-local
 * scan result shape and persist the outcome to the {@link MediaAsset}
 * row. Infected files are quarantined by setting the asset's `status`
 * to `QUARANTINED`.
 */
@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);

  constructor(
    private readonly pompelmi: PompelmiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Scans an in-memory buffer and persists the verdict. The caller is
   * responsible for fetching the buffer from object storage.
   */
  async scanBuffer(
    buffer: Buffer,
    mediaAssetId: string,
  ): Promise<VirusScanResult> {
    const verdict = (await this.pompelmi.scanBuffer(buffer)) as PompelmiVerdict;
    const result = this.toResult(verdict);

    await this.prisma.mediaAsset.update({
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

    return result;
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
