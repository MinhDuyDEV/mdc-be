import * as crypto from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { CompanyRole, type Prisma } from "@prisma/client";
import { EntitlementsService } from "../billing/entitlements/entitlements.service";
import { PrismaService } from "../infra/prisma/prisma.service";
import { IdempotencyService } from "../outbox/idempotency.service";
import { OutboxService } from "../outbox/outbox.service";
import type { AddMemberDto } from "./dto/add-member.dto";
import type { CreateCompanyDto } from "./dto/create-company.dto";
import type { InviteMemberDto } from "./dto/invite-member.dto";
import type { ListCompaniesDto } from "./dto/list-companies.dto";
import type { UpdateCompanyDto } from "./dto/update-company.dto";
import type { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

const ROLE_LEVEL: Record<CompanyRole, number> = {
	OWNER: 3,
	ADMIN: 2,
	MEMBER: 1,
	BILLING_ADMIN: 1,
};

function hasRoleAtLeast(actual: CompanyRole, required: CompanyRole): boolean {
	const actualLevel = ROLE_LEVEL[actual] ?? 0;
	return actualLevel >= ROLE_LEVEL[required];
}

/**
 * Privilege-cap helper: an actor cannot grant a role higher than their own.
 * Prevents ADMIN from minting an OWNER via add/invite/promote.
 */
function assertCanGrantRole(
	actorRole: CompanyRole,
	requestedRole: CompanyRole,
): void {
	if (ROLE_LEVEL[requestedRole] > ROLE_LEVEL[actorRole]) {
		throw new ForbiddenException("INSUFFICIENT_PRIVILEGE_FOR_ROLE_GRANT");
	}
}

/**
 * Privilege-cap helper: an actor cannot modify a member whose role is higher than their own.
 * Prevents ADMIN from demoting/removing OWNERs.
 */
function assertCanModifyTarget(
	actorRole: CompanyRole,
	targetRole: CompanyRole,
): void {
	if (ROLE_LEVEL[targetRole] > ROLE_LEVEL[actorRole]) {
		throw new ForbiddenException("INSUFFICIENT_PRIVILEGE_FOR_TARGET");
	}
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(
	prisma: PrismaService,
	name: string,
): Promise<string> {
	const baseSlug = slugify(name);
	let slug = baseSlug;
	let counter = 2;

	while (await prisma.company.count({ where: { slug, deletedAt: null } })) {
		slug = `${baseSlug}-${counter}`;
		counter++;
		if (counter > 100) {
			throw new ConflictException("Unable to generate unique slug");
		}
	}

	return slug;
}

/**
 * Try to insert a company row, retrying with a numeric suffix on slug
 * P2002 (unique-constraint) conflicts. Closes the TOCTOU window between
 * `count` and `create` when two concurrent calls pick the same slug.
 *
 * The DB enforces uniqueness via `companies_slug_active_key`
 * (partial unique on slug WHERE deleted_at IS NULL).
 */
async function createCompanyWithUniqueSlug<T>(
	tx: Prisma.TransactionClient,
	baseName: string,
	buildData: (slug: string) => Prisma.CompanyCreateInput,
	create: (data: Prisma.CompanyCreateInput) => Promise<T>,
): Promise<T> {
	const baseSlug = slugify(baseName);
	// Pre-pick a slug that's free at the moment we start. The retry loop
	// below covers concurrent inserts that race past this check.
	let counter = 1;
	let slug = baseSlug;
	for (let attempt = 0; attempt < 100; attempt++) {
		const taken = await tx.company.count({
			where: { slug, deletedAt: null },
		});
		if (taken === 0) {
			try {
				return await create(buildData(slug));
			} catch (e) {
				// Prisma P2002 = unique constraint violation
				if (
					typeof e === "object" &&
					e !== null &&
					"code" in e &&
					(e as { code?: string }).code === "P2002"
				) {
					counter++;
					slug = `${baseSlug}-${counter}`;
					continue;
				}
				throw e;
			}
		}
		counter++;
		slug = `${baseSlug}-${counter}`;
	}
	throw new ConflictException("Unable to generate unique slug");
}

const COMPANY_INCLUDES = {
	logoMediaAsset: true,
	coverMediaAsset: true,
	_count: {
		select: {
			followers: true,
			members: true,
		},
	},
} as const;

@Injectable()
export class CompaniesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly outboxService: OutboxService,
		private readonly idempotencyService: IdempotencyService,
		private readonly entitlementsService: EntitlementsService,
	) {}

	async createCompany(userId: string, data: CreateCompanyDto) {
		// FR1: only verified users can create companies
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, emailVerifiedAt: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}
		if (!user.emailVerifiedAt) {
			throw new ForbiddenException("EMAIL_NOT_VERIFIED");
		}

		// NFR: idempotent creation per (user, name) tuple
		await this.idempotencyService.claim(
			"CompanyCreate",
			`${userId}:${data.name}`,
		);

		return this.prisma.$transaction(async (tx) => {
			const company = await createCompanyWithUniqueSlug(
				tx,
				data.name,
				(slug) => ({
					name: data.name,
					slug,
					industry: data.industry,
					description: data.description,
					website: data.website,
					employeeCount: data.employeeCount,
					foundedYear: data.foundedYear,
					headquarters: data.headquarters,
				}),
				(input) => tx.company.create({ data: input }),
			);

			await tx.companyMember.create({
				data: {
					companyId: company.id,
					userId,
					role: CompanyRole.OWNER,
					status: "active",
				},
			});

			await tx.auditLog.create({
				data: {
					actorUserId: userId,
					action: "company.create",
					entityType: "Company",
					entityId: company.id,
					metadata: { name: company.name, slug: company.slug },
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "CompanyCreated",
				aggregateType: "Company",
				aggregateId: company.id,
				payload: {
					companyId: company.id,
					name: company.name,
					slug: company.slug,
					creatorUserId: userId,
				},
			});

			return company;
		});
	}

	async getCompanyBySlug(slug: string) {
		const company = await this.prisma.company.findFirst({
			where: { slug, deletedAt: null },
			include: COMPANY_INCLUDES,
		});

		if (!company) {
			throw new NotFoundException("Company not found");
		}

		return company;
	}

	async followCompany(userId: string, companyId: string) {
		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
			});

			if (!company) {
				throw new NotFoundException("Company not found");
			}

			const existing = await tx.companyFollower.findUnique({
				where: {
					companyId_userId: { companyId, userId },
				},
			});

			// FR7: idempotent — already-following is a no-op success.
			if (existing) {
				return;
			}

			await tx.companyFollower.create({
				data: { companyId, userId },
			});

			await tx.company.update({
				where: { id: companyId },
				data: { followerCount: { increment: 1 } },
			});

			await this.outboxService.emit(tx as any, {
				eventType: "CompanyFollowed",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: { companyId, userId },
			});
		});
	}

	async unfollowCompany(userId: string, companyId: string) {
		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
				select: { id: true },
			});
			if (!company) {
				throw new NotFoundException("Company not found");
			}

			const existing = await tx.companyFollower.findUnique({
				where: {
					companyId_userId: { companyId, userId },
				},
			});

			if (!existing) {
				throw new NotFoundException("Not following this company");
			}

			await tx.companyFollower.delete({
				where: { id: existing.id },
			});

			await tx.company.update({
				where: { id: companyId },
				data: { followerCount: { decrement: 1 } },
			});

			await this.outboxService.emit(tx as any, {
				eventType: "CompanyUnfollowed",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: { companyId, userId },
			});
		});
	}

	async updateCompany(
		userId: string,
		companyId: string,
		data: UpdateCompanyDto,
	) {
		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
			});

			if (!company) {
				throw new NotFoundException("Company not found");
			}

			const member = await tx.companyMember.findUnique({
				where: {
					companyId_userId: { companyId, userId },
				},
			});

			if (!member || !hasRoleAtLeast(member.role, CompanyRole.ADMIN)) {
				throw new ForbiddenException(
					"Only company admins or owners can update the company",
				);
			}

			// Regenerate slug if name changed
			let slug: string | undefined;
			if (data.name && data.name !== company.name) {
				slug = await generateUniqueSlug(tx as any, data.name);
			}

			const updated = await tx.company.update({
				where: { id: companyId },
				data: {
					...(data.name !== undefined && { name: data.name }),
					...(slug !== undefined && { slug }),
					...(data.industry !== undefined && { industry: data.industry }),
					...(data.description !== undefined && {
						description: data.description,
					}),
					...(data.website !== undefined && { website: data.website }),
					...(data.employeeCount !== undefined && {
						employeeCount: data.employeeCount,
					}),
					...(data.foundedYear !== undefined && {
						foundedYear: data.foundedYear,
					}),
					...(data.headquarters !== undefined && {
						headquarters: data.headquarters,
					}),
					...(data.logoMediaAssetId !== undefined && {
						logoMediaAssetId: data.logoMediaAssetId,
					}),
					...(data.coverMediaAssetId !== undefined && {
						coverMediaAssetId: data.coverMediaAssetId,
					}),
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "CompanyUpdated",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: {
					companyId,
					previousName: company.name,
					newName: data.name,
				},
			});

			return updated;
		});
	}

	async inviteMember(userId: string, companyId: string, data: InviteMemberDto) {
		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
			});

			if (!company) {
				throw new NotFoundException("Company not found");
			}

			const member = await tx.companyMember.findUnique({
				where: {
					companyId_userId: { companyId, userId },
				},
			});

			if (!member || !hasRoleAtLeast(member.role, CompanyRole.ADMIN)) {
				throw new ForbiddenException(
					"Only company admins or owners can invite members",
				);
			}

			// Privilege cap: actor cannot invite at a role higher than their own.
			assertCanGrantRole(member.role, data.role);

			const token = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

			const invitation = await tx.memberInvitation.create({
				data: {
					companyId,
					email: data.email,
					role: data.role,
					token,
					invitedBy: userId,
					status: "pending",
					expiresAt,
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "MemberInvited",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: {
					companyId,
					invitationId: invitation.id,
					email: data.email,
					role: data.role,
					invitedBy: userId,
				},
			});

			return invitation;
		});
	}

	async acceptInvitation(userId: string, token: string) {
		return this.prisma.$transaction(async (tx) => {
			const invitation = await tx.memberInvitation.findUnique({
				where: { token },
			});

			if (!invitation) {
				throw new NotFoundException("Invitation not found");
			}

			if (invitation.status !== "pending") {
				throw new BadRequestException(
					`Invitation is already ${invitation.status}`,
				);
			}

			if (new Date() > invitation.expiresAt) {
				throw new BadRequestException("Invitation has expired");
			}

			// Identity binding: caller must be the invited user (matched by email)
			// AND must have a verified email. Prevents token-leak takeover.
			const acceptingUser = await tx.user.findUnique({
				where: { id: userId },
				select: { email: true, emailVerifiedAt: true },
			});
			if (!acceptingUser) {
				throw new NotFoundException("User not found");
			}
			if (
				acceptingUser.email.toLowerCase() !== invitation.email.toLowerCase()
			) {
				throw new ForbiddenException("INVITATION_EMAIL_MISMATCH");
			}
			if (!acceptingUser.emailVerifiedAt) {
				throw new ForbiddenException("EMAIL_NOT_VERIFIED");
			}

			// Idempotency: if user is already a member, mark invitation accepted and return.
			const existingMember = await tx.companyMember.findUnique({
				where: {
					companyId_userId: {
						companyId: invitation.companyId,
						userId,
					},
				},
			});
			if (existingMember) {
				await tx.memberInvitation.update({
					where: { id: invitation.id },
					data: { status: "accepted", acceptedAt: new Date() },
				});
				return existingMember;
			}

			const member = await tx.companyMember.create({
				data: {
					companyId: invitation.companyId,
					userId,
					// invitation.role is stored as String in the DB but is validated
					// as a CompanyRole enum at write-time via InviteMemberDto.
					role: invitation.role as CompanyRole,
					status: "active",
				},
			});

			await tx.memberInvitation.update({
				where: { id: invitation.id },
				data: {
					status: "accepted",
					acceptedAt: new Date(),
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "MemberJoined",
				aggregateType: "Company",
				aggregateId: invitation.companyId,
				payload: {
					companyId: invitation.companyId,
					userId,
					role: invitation.role,
					invitationId: invitation.id,
				},
			});

			return member;
		});
	}

	async allocateRecruiterSeat(
		userId: string,
		companyId: string,
		targetUserId: string,
	) {
		// Check seat limit before transaction
		const hasSeats = await this.entitlementsService.checkLimit(
			companyId,
			"recruiter_seats",
		);
		if (!hasSeats) {
			throw new ForbiddenException("RECRUITER_SEAT_LIMIT_EXCEEDED");
		}

		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
			});

			if (!company) {
				throw new NotFoundException("Company not found");
			}

			const member = await tx.companyMember.findUnique({
				where: {
					companyId_userId: { companyId, userId },
				},
			});

			if (!member || !hasRoleAtLeast(member.role, CompanyRole.ADMIN)) {
				throw new ForbiddenException(
					"Only company admins or owners can allocate recruiter seats",
				);
			}

			// Check target user exists
			const targetUser = await tx.user.findUnique({
				where: { id: targetUserId },
			});

			if (!targetUser) {
				throw new NotFoundException("Target user not found");
			}

			// Find an available seat
			const availableSeat = await tx.recruiterSeat.findFirst({
				where: {
					companyId,
					status: "available",
				},
			});

			if (!availableSeat) {
				throw new BadRequestException("No available recruiter seats");
			}

			// Atomic claim: only succeeds if status is still 'available'.
			// Closes TOCTOU race where two admins could read the same seat
			// and both call update() with conflicting userIds.
			const claimed = await tx.recruiterSeat.updateMany({
				where: { id: availableSeat.id, status: "available" },
				data: {
					userId: targetUserId,
					status: "allocated",
					allocatedAt: new Date(),
				},
			});
			if (claimed.count === 0) {
				throw new ConflictException(
					"Recruiter seat was claimed concurrently; retry",
				);
			}

			const seat = await tx.recruiterSeat.findUniqueOrThrow({
				where: { id: availableSeat.id },
			});

			await this.outboxService.emit(tx as any, {
				eventType: "RecruiterSeatAllocated",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: {
					companyId,
					seatId: seat.id,
					userId: targetUserId,
					allocatedBy: userId,
				},
			});

			return seat;
		});
	}

	async deallocateRecruiterSeat(
		userId: string,
		companyId: string,
		seatId: string,
	) {
		return this.prisma.$transaction(async (tx) => {
			const member = await tx.companyMember.findUnique({
				where: {
					companyId_userId: { companyId, userId },
				},
			});

			if (!member || !hasRoleAtLeast(member.role, CompanyRole.ADMIN)) {
				throw new ForbiddenException(
					"Only company admins or owners can deallocate recruiter seats",
				);
			}

			const seat = await tx.recruiterSeat.findUnique({
				where: { id: seatId },
			});

			if (!seat || seat.companyId !== companyId) {
				throw new NotFoundException("Recruiter seat not found");
			}

			if (seat.status !== "allocated") {
				throw new BadRequestException(
					`Recruiter seat is ${seat.status}, not allocated`,
				);
			}

			const updated = await tx.recruiterSeat.update({
				where: { id: seatId },
				data: {
					userId: null,
					status: "available",
					allocatedAt: null,
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "RecruiterSeatDeallocated",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: {
					companyId,
					seatId,
					userId: seat.userId,
					deallocatedBy: userId,
				},
			});

			return updated;
		});
	}

	async getCompanyById(companyId: string) {
		const company = await this.prisma.company.findFirst({
			where: { id: companyId, deletedAt: null },
			include: COMPANY_INCLUDES,
		});
		if (!company) {
			throw new NotFoundException("Company not found");
		}
		return company;
	}

	async listCompanies(query: ListCompaniesDto) {
		const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
		const cursor = query.cursor;

		const where: Prisma.CompanyWhereInput = { deletedAt: null };
		if (query.search) {
			where.OR = [
				{ name: { contains: query.search, mode: "insensitive" } },
				{ description: { contains: query.search, mode: "insensitive" } },
			];
		}

		// Cursor pagination — fetch limit+1 to detect hasMore
		const rows = await this.prisma.company.findMany({
			where,
			orderBy: [{ name: "asc" }, { id: "asc" }],
			take: limit + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			select: {
				id: true,
				name: true,
				slug: true,
				industry: true,
				description: true,
				website: true,
				headquarters: true,
				employeeCount: true,
				foundedYear: true,
				verified: true,
				verifiedAt: true,
				followerCount: true,
				logoMediaAssetId: true,
				coverMediaAssetId: true,
				createdAt: true,
			},
		});

		const hasMore = rows.length > limit;
		const data = hasMore ? rows.slice(0, limit) : rows;
		const nextCursor =
			hasMore && data.length > 0 ? data[data.length - 1].id : null;

		return { data, meta: { nextCursor, hasMore } };
	}

	async addMember(actorUserId: string, companyId: string, dto: AddMemberDto) {
		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
				select: { id: true },
			});
			if (!company) throw new NotFoundException("Company not found");

			const actor = await tx.companyMember.findUnique({
				where: { companyId_userId: { companyId, userId: actorUserId } },
			});
			if (!actor || !hasRoleAtLeast(actor.role, CompanyRole.ADMIN)) {
				throw new ForbiddenException(
					"Only company admins or owners can add members",
				);
			}

			// Privilege cap: actor cannot grant a role higher than their own.
			assertCanGrantRole(actor.role, dto.role);

			const target = await tx.user.findUnique({
				where: { id: dto.userId },
				select: { id: true },
			});
			if (!target) throw new NotFoundException("Target user not found");

			const existing = await tx.companyMember.findUnique({
				where: {
					companyId_userId: { companyId, userId: dto.userId },
				},
			});
			if (existing) {
				throw new ConflictException("User is already a member");
			}

			const member = await tx.companyMember.create({
				data: {
					companyId,
					userId: dto.userId,
					role: dto.role,
					status: "active",
				},
			});

			await tx.auditLog.create({
				data: {
					actorUserId,
					action: "company.member.add",
					entityType: "Company",
					entityId: companyId,
					metadata: { addedUserId: dto.userId, role: dto.role },
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "CompanyMemberAdded",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: {
					companyId,
					userId: dto.userId,
					role: dto.role,
					addedBy: actorUserId,
				},
			});

			return member;
		});
	}

	async listMembers(
		actorUserId: string,
		companyId: string,
		query: { limit?: number; cursor?: string },
	) {
		const company = await this.prisma.company.findFirst({
			where: { id: companyId, deletedAt: null },
			select: { id: true },
		});
		if (!company) throw new NotFoundException("Company not found");

		const actor = await this.prisma.companyMember.findUnique({
			where: { companyId_userId: { companyId, userId: actorUserId } },
		});
		if (!actor || actor.status !== "active") {
			throw new ForbiddenException("Only members can view the member list");
		}

		const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

		const rows = await this.prisma.companyMember.findMany({
			where: { companyId, status: "active" },
			orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
			take: limit + 1,
			...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
			include: {
				user: {
					select: { id: true, displayName: true, email: true },
				},
			},
		});

		const hasMore = rows.length > limit;
		const data = hasMore ? rows.slice(0, limit) : rows;
		const nextCursor =
			hasMore && data.length > 0 ? data[data.length - 1].id : null;

		return { data, meta: { nextCursor, hasMore } };
	}

	async updateMemberRole(
		actorUserId: string,
		companyId: string,
		memberId: string,
		dto: UpdateMemberRoleDto,
	) {
		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
				select: { id: true },
			});
			if (!company) throw new NotFoundException("Company not found");

			const actor = await tx.companyMember.findUnique({
				where: { companyId_userId: { companyId, userId: actorUserId } },
			});
			if (!actor || !hasRoleAtLeast(actor.role, CompanyRole.ADMIN)) {
				throw new ForbiddenException(
					"Only company admins or owners can change member roles",
				);
			}

			const target = await tx.companyMember.findUnique({
				where: { id: memberId },
			});
			if (!target || target.companyId !== companyId) {
				throw new NotFoundException("Member not found");
			}

			// Privilege caps: actor must outrank both the target's current role AND the new role.
			assertCanModifyTarget(actor.role, target.role);
			assertCanGrantRole(actor.role, dto.role);

			// Last-owner protection: refuse demotion that leaves zero OWNERs.
			if (target.role === CompanyRole.OWNER && dto.role !== CompanyRole.OWNER) {
				const ownerCount = await tx.companyMember.count({
					where: { companyId, role: CompanyRole.OWNER, status: "active" },
				});
				if (ownerCount <= 1) {
					throw new BadRequestException("CANNOT_DEMOTE_LAST_OWNER");
				}
			}

			const updated = await tx.companyMember.update({
				where: { id: memberId },
				data: { role: dto.role },
			});

			await tx.auditLog.create({
				data: {
					actorUserId,
					action: "company.member.update_role",
					entityType: "Company",
					entityId: companyId,
					metadata: {
						memberId,
						previousRole: target.role,
						newRole: dto.role,
					},
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "CompanyMemberRoleChanged",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: {
					companyId,
					memberId,
					userId: target.userId,
					previousRole: target.role,
					newRole: dto.role,
					changedBy: actorUserId,
				},
			});

			return updated;
		});
	}

	async removeMember(actorUserId: string, companyId: string, memberId: string) {
		return this.prisma.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: companyId, deletedAt: null },
				select: { id: true },
			});
			if (!company) throw new NotFoundException("Company not found");

			const actor = await tx.companyMember.findUnique({
				where: { companyId_userId: { companyId, userId: actorUserId } },
			});
			if (!actor || !hasRoleAtLeast(actor.role, CompanyRole.ADMIN)) {
				throw new ForbiddenException(
					"Only company admins or owners can remove members",
				);
			}

			const target = await tx.companyMember.findUnique({
				where: { id: memberId },
			});
			if (!target || target.companyId !== companyId) {
				throw new NotFoundException("Member not found");
			}

			// Privilege cap: actor must outrank the target's current role.
			assertCanModifyTarget(actor.role, target.role);

			if (target.role === CompanyRole.OWNER) {
				const ownerCount = await tx.companyMember.count({
					where: { companyId, role: CompanyRole.OWNER, status: "active" },
				});
				if (ownerCount <= 1) {
					throw new BadRequestException("CANNOT_REMOVE_LAST_OWNER");
				}
			}

			await tx.companyMember.delete({ where: { id: memberId } });

			await tx.auditLog.create({
				data: {
					actorUserId,
					action: "company.member.remove",
					entityType: "Company",
					entityId: companyId,
					metadata: {
						memberId,
						removedUserId: target.userId,
						previousRole: target.role,
					},
				},
			});

			await this.outboxService.emit(tx as any, {
				eventType: "CompanyMemberRemoved",
				aggregateType: "Company",
				aggregateId: companyId,
				payload: {
					companyId,
					memberId,
					userId: target.userId,
					previousRole: target.role,
					removedBy: actorUserId,
				},
			});
		});
	}
}
