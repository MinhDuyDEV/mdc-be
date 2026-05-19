import { Injectable } from "@nestjs/common";
import { ApplicationStatus } from "@prisma/client";
import type { PrismaService } from "../infra/prisma/prisma.service";

/**
 * Discriminated decision returned by `canMessageCandidate`. Phase 7 messaging
 * will consume this to decide whether to allow a recruiter-to-candidate DM.
 */
export type RecruitingMessageDecision =
	| {
			allowed: true;
			reason: "APPLICATION_CONTEXT" | "TALENT_POOL_CONTEXT" | "OPT_IN";
	  }
	| {
			allowed: false;
			reason:
				| "NO_RECRUITING_AUTHORIZATION"
				| "CANDIDATE_NOT_OPTED_IN"
				| "SELF_OUTREACH";
	  };

/**
 * RecruitingPolicyService — pure policy resolution for recruiter→candidate
 * outreach. No HTTP routes in Phase 4; exported for Phase 7 messaging.
 */
@Injectable()
export class RecruitingPolicyService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Returns a discriminated decision about whether `recruiterUserId` may
	 * message `candidateUserId`. See FR-6 in the Phase 4 PRD.
	 *
	 * Allow conditions (any one suffices):
	 *  - Candidate has an active Application to a Job at a company where the
	 *    recruiter holds OWNER/ADMIN/RecruiterSeat.
	 *  - Candidate is in an active TalentPool of such a company.
	 *  - Candidate's Profile.recruitingEligible = true (and no Block — Phase 5
	 *    stub returns false here).
	 *
	 * Deny conditions:
	 *  - Recruiter has no active RecruiterSeat AND no admin/owner role
	 *    anywhere → NO_RECRUITING_AUTHORIZATION.
	 *  - Candidate's Profile.recruitingEligible = false AND no application/
	 *    talent-pool context → CANDIDATE_NOT_OPTED_IN.
	 *  - Recruiter and candidate are the same user → SELF_OUTREACH.
	 */
	async canMessageCandidate(
		recruiterUserId: string,
		candidateUserId: string,
	): Promise<RecruitingMessageDecision> {
		if (recruiterUserId === candidateUserId) {
			return { allowed: false, reason: "SELF_OUTREACH" };
		}

		// 1. Find every company where the recruiter holds an active recruiting role.
		const recruiterCompanies =
			await this.findRecruiterCompanies(recruiterUserId);
		if (recruiterCompanies.size === 0) {
			return { allowed: false, reason: "NO_RECRUITING_AUTHORIZATION" };
		}
		const recruiterCompanyIds = [...recruiterCompanies];

		// 2. APPLICATION_CONTEXT: candidate has an active application at one of
		//    those companies.
		const application = await this.prisma.application.findFirst({
			where: {
				userId: candidateUserId,
				status: {
					notIn: [ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED],
				},
				job: {
					companyId: { in: recruiterCompanyIds },
					deletedAt: null,
				},
			},
			select: { id: true },
		});
		if (application) {
			return { allowed: true, reason: "APPLICATION_CONTEXT" };
		}

		// 3. TALENT_POOL_CONTEXT: candidate is in an active TalentPool at one of
		//    those companies.
		const poolMembership = await this.prisma.talentPoolCandidate.findFirst({
			where: {
				candidateUserId,
				deletedAt: null,
				talentPool: {
					companyId: { in: recruiterCompanyIds },
					deletedAt: null,
				},
			},
			select: { id: true },
		});
		if (poolMembership) {
			return { allowed: true, reason: "TALENT_POOL_CONTEXT" };
		}

		// 4. OPT_IN: candidate's profile is recruitingEligible.
		const profile = await this.prisma.profile.findUnique({
			where: { userId: candidateUserId },
			select: { recruitingEligible: true },
		});
		if (!profile) {
			return { allowed: false, reason: "CANDIDATE_NOT_OPTED_IN" };
		}

		// Phase 5 will check Block here. Phase 4 stub: never blocked.
		const isBlocked = false;

		if (profile.recruitingEligible && !isBlocked) {
			return { allowed: true, reason: "OPT_IN" };
		}

		return { allowed: false, reason: "CANDIDATE_NOT_OPTED_IN" };
	}

	/**
	 * Returns the set of companyIds where `userId` holds OWNER, ADMIN, or
	 * an active (allocated) RecruiterSeat.
	 */
	private async findRecruiterCompanies(userId: string): Promise<Set<string>> {
		const [members, seats] = await Promise.all([
			this.prisma.companyMember.findMany({
				where: {
					userId,
					status: "active",
					role: { in: ["OWNER", "ADMIN"] },
				},
				select: { companyId: true },
			}),
			this.prisma.recruiterSeat.findMany({
				where: {
					userId,
					status: "allocated",
				},
				select: { companyId: true },
			}),
		]);
		const ids = new Set<string>();
		for (const m of members) ids.add(m.companyId);
		for (const s of seats) ids.add(s.companyId);
		return ids;
	}
}
