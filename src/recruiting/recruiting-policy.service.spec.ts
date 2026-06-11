import { ApplicationStatus } from "@prisma/client";
import type { ConnectionsPolicyService } from "../connections/connections-policy.service";
import type { PrismaService } from "../infra/prisma/prisma.service";
import { RecruitingPolicyService } from "./recruiting-policy.service";

interface MockPrisma {
  companyMember: { findMany: jest.Mock };
  recruiterSeat: { findMany: jest.Mock };
  application: { findFirst: jest.Mock };
  talentPoolCandidate: { findFirst: jest.Mock };
  profile: { findUnique: jest.Mock; findFirst: jest.Mock };
}

interface MockConnectionsPolicy {
  isBlocked: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  return {
    companyMember: { findMany: jest.fn().mockResolvedValue([]) },
    recruiterSeat: { findMany: jest.fn().mockResolvedValue([]) },
    application: { findFirst: jest.fn().mockResolvedValue(null) },
    talentPoolCandidate: { findFirst: jest.fn().mockResolvedValue(null) },
    profile: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

function buildMockConnectionsPolicy(): MockConnectionsPolicy {
  return {
    isBlocked: jest.fn().mockResolvedValue(false),
  };
}

describe("RecruitingPolicyService", () => {
  let prisma: MockPrisma;
  let connectionsPolicy: MockConnectionsPolicy;
  let service: RecruitingPolicyService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    connectionsPolicy = buildMockConnectionsPolicy();
    service = new RecruitingPolicyService(
      prisma as unknown as PrismaService,
      connectionsPolicy as unknown as ConnectionsPolicyService,
    );
  });

  describe("SELF_OUTREACH", () => {
    it("denies when recruiter and candidate are the same user", async () => {
      const decision = await service.canMessageCandidate("u-1", "u-1");
      expect(decision).toEqual({ allowed: false, reason: "SELF_OUTREACH" });
    });
  });

  describe("NO_RECRUITING_AUTHORIZATION", () => {
    it("denies when caller has no admin/owner role and no seats", async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.recruiterSeat.findMany.mockResolvedValue([]);

      const decision = await service.canMessageCandidate("recruiter", "cand");
      expect(decision).toEqual({
        allowed: false,
        reason: "NO_RECRUITING_AUTHORIZATION",
      });
    });
  });

  describe("APPLICATION_CONTEXT", () => {
    it("allows when candidate has an active application at recruiter's company", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.application.findFirst.mockResolvedValue({ id: "app-1" });

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision).toEqual({
        allowed: true,
        reason: "APPLICATION_CONTEXT",
      });
    });

    it("ignores WITHDRAWN/REJECTED applications (uses notIn filter)", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      // application.findFirst should be called with status notIn list
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.profile.findFirst.mockResolvedValue({
        recruitingEligible: false,
      });

      await service.canMessageCandidate("rec", "cand");

      const args = prisma.application.findFirst.mock.calls[0][0];
      expect(args.where.status.notIn).toContain(ApplicationStatus.WITHDRAWN);
      expect(args.where.status.notIn).toContain(ApplicationStatus.REJECTED);
    });
  });

  describe("TALENT_POOL_CONTEXT", () => {
    it("allows when candidate is in a TalentPool of recruiter's company", async () => {
      prisma.recruiterSeat.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.talentPoolCandidate.findFirst.mockResolvedValue({ id: "tpc-1" });

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision).toEqual({
        allowed: true,
        reason: "TALENT_POOL_CONTEXT",
      });
    });
  });

  describe("OPT_IN", () => {
    it("allows when candidate Profile.recruitingEligible=true and no other context", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.talentPoolCandidate.findFirst.mockResolvedValue(null);
      prisma.profile.findFirst.mockResolvedValue({ recruitingEligible: true });

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision).toEqual({ allowed: true, reason: "OPT_IN" });
    });

    it("denies CANDIDATE_NOT_OPTED_IN when profile.recruitingEligible=false", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.profile.findFirst.mockResolvedValue({
        recruitingEligible: false,
      });

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision).toEqual({
        allowed: false,
        reason: "CANDIDATE_NOT_OPTED_IN",
      });
    });

    it("denies CANDIDATE_NOT_OPTED_IN when profile is missing entirely", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.profile.findFirst.mockResolvedValue(null);

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision).toEqual({
        allowed: false,
        reason: "CANDIDATE_NOT_OPTED_IN",
      });
    });
  });

  describe("BLOCKED", () => {
    it("denies with BLOCKED reason when either party has blocked the other", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.talentPoolCandidate.findFirst.mockResolvedValue(null);
      prisma.profile.findFirst.mockResolvedValue({ recruitingEligible: true });
      connectionsPolicy.isBlocked.mockResolvedValue(true);

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision).toEqual({ allowed: false, reason: "BLOCKED" });
    });
  });

  describe("recruiter source — admin OR seat", () => {
    it("admin role alone grants recruiter authorization", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-admin" }]);
      prisma.recruiterSeat.findMany.mockResolvedValue([]);
      prisma.profile.findFirst.mockResolvedValue({ recruitingEligible: true });

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision.allowed).toBe(true);
    });

    it("active RecruiterSeat alone grants recruiter authorization", async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.recruiterSeat.findMany.mockResolvedValue([{ companyId: "c-seat" }]);
      prisma.profile.findFirst.mockResolvedValue({ recruitingEligible: true });

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision.allowed).toBe(true);
    });

    it("dedupes overlapping companyIds across admin role + seat", async () => {
      prisma.companyMember.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.recruiterSeat.findMany.mockResolvedValue([{ companyId: "c-1" }]);
      prisma.application.findFirst.mockResolvedValue({ id: "app-1" });

      const decision = await service.canMessageCandidate("rec", "cand");
      expect(decision.allowed).toBe(true);

      const findFirstCall = prisma.application.findFirst.mock.calls[0][0];
      expect(findFirstCall.where.job.companyId.in).toEqual(["c-1"]);
    });
  });
});
