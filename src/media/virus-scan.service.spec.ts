import { VirusScanService } from "./virus-scan.service";

describe("VirusScanService", () => {
  let service: VirusScanService;
  let pompelmi: { scanBuffer: jest.Mock };
  let prisma: { mediaAsset: { update: jest.Mock } };

  beforeEach(() => {
    pompelmi = { scanBuffer: jest.fn() };
    prisma = { mediaAsset: { update: jest.fn().mockResolvedValue({}) } };
    service = new VirusScanService(pompelmi as never, prisma as never);
  });

  describe("scanBuffer", () => {
    it("returns a clean result when pompelmi reports Clean", async () => {
      pompelmi.scanBuffer.mockResolvedValue({ kind: "clean" });

      const result = await service.scanBuffer(Buffer.from("hello"), "asset-1");

      expect(result.clean).toBe(true);
      expect(result.threats).toEqual([]);
      expect(result.engine).toBe("pompelmi");
      expect(result.scannedAt).toBeInstanceOf(Date);
    });

    it("returns threats and persists QUARANTINED status when malware is detected", async () => {
      pompelmi.scanBuffer.mockResolvedValue({
        kind: "malicious",
        threats: ["Win.Test.EICAR_HDB-1"],
      });

      const result = await service.scanBuffer(Buffer.from("eicar"), "asset-1");

      expect(result.clean).toBe(false);
      expect(result.threats).toEqual(["Win.Test.EICAR_HDB-1"]);
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "asset-1" },
          data: expect.objectContaining({
            scanStatus: "INFECTED",
            status: "QUARANTINED",
          }),
        }),
      );
    });

    it("treats a ScanError verdict as a non-fatal failed scan (not clean, not malware)", async () => {
      pompelmi.scanBuffer.mockResolvedValue({
        kind: "error",
        reason: "clamd unreachable",
      });

      const result = await service.scanBuffer(Buffer.from("x"), "asset-1");

      expect(result.clean).toBe(false);
      expect(result.threats).toContain("SCAN_ERROR:clamd unreachable");
    });
  });
});
