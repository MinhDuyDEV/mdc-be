import { VirusScanService } from './virus-scan.service';

describe('VirusScanService', () => {
  let service: VirusScanService;
  let pompelmi: { scanBuffer: jest.Mock };
  let prisma: { mediaAsset: { update: jest.Mock } };

  beforeEach(() => {
    pompelmi = { scanBuffer: jest.fn() };
    prisma = { mediaAsset: { update: jest.fn().mockResolvedValue({}) } };
    service = new VirusScanService(pompelmi as never, prisma as never);
  });

  describe('scanBuffer', () => {
    it('returns a clean result when pompelmi reports Clean', async () => {
      pompelmi.scanBuffer.mockResolvedValue({ kind: 'clean' });

      const result = await service.scanBuffer(Buffer.from('hello'));

      expect(result.clean).toBe(true);
      expect(result.threats).toEqual([]);
      expect(result.engine).toBe('pompelmi');
      expect(result.scannedAt).toBeInstanceOf(Date);
    });

    it('returns threats when malware is detected', async () => {
      pompelmi.scanBuffer.mockResolvedValue({
        kind: 'malicious',
        threats: ['Win.Test.EICAR_HDB-1'],
      });

      const result = await service.scanBuffer(Buffer.from('eicar'));

      expect(result.clean).toBe(false);
      expect(result.threats).toEqual(['Win.Test.EICAR_HDB-1']);
    });

    it('treats a ScanError verdict as a non-fatal failed scan (not clean, not malware)', async () => {
      pompelmi.scanBuffer.mockResolvedValue({
        kind: 'error',
        reason: 'clamd unreachable',
      });

      const result = await service.scanBuffer(Buffer.from('x'));

      expect(result.clean).toBe(false);
      expect(result.threats).toContain('SCAN_ERROR:clamd unreachable');
    });

    it('rejects when scan times out', async () => {
      // Simulate a scan that never resolves (timeout)
      pompelmi.scanBuffer.mockReturnValue(new Promise(() => {}));

      await expect(service.scanBuffer(Buffer.from('slow'))).rejects.toThrow(
        /timed out/i,
      );
    }, 35000); // Must exceed the 30s scan timeout
  });

  describe('persistScanResult', () => {
    it('writes CLEAN status for a clean result', async () => {
      const result = {
        clean: true,
        threats: [],
        engine: 'pompelmi' as const,
        scannedAt: new Date(),
      };

      await service.persistScanResult('asset-1', result);

      expect(prisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({ scanStatus: 'CLEAN' }),
        }),
      );
    });

    it('writes INFECTED and QUARANTINED status for a malicious result', async () => {
      const result = {
        clean: false,
        threats: ['Win.Test.EICAR_HDB-1'],
        engine: 'pompelmi' as const,
        scannedAt: new Date(),
      };

      await service.persistScanResult('asset-1', result);

      expect(prisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({
            scanStatus: 'INFECTED',
            status: 'QUARANTINED',
          }),
        }),
      );
    });
  });
});
