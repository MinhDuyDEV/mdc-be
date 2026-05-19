import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../infra/prisma/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import type { CreateCompanyDto } from "./dto/create-company.dto";
import type { UpdateCompanyDto } from "./dto/update-company.dto";
import type { InviteMemberDto } from "./dto/invite-member.dto";
import * as crypto from "node:crypto";

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

  while (await prisma.company.count({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    if (counter > 100) {
      throw new ConflictException("Unable to generate unique slug");
    }
  }

  return slug;
}

const COMPANY_INCLUDES = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  },
  logoMediaAsset: true,
  coverMediaAsset: true,
  _count: {
    select: {
      followers: true,
    },
  },
} as const;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
  ) {}

  async createCompany(userId: string, data: CreateCompanyDto) {
    const slug = await generateUniqueSlug(this.prisma, data.name);

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.name,
          slug,
          industry: data.industry,
          description: data.description,
          website: data.website,
          employeeCount: data.employeeCount,
          foundedYear: data.foundedYear,
          headquarters: data.headquarters,
        },
      });

      await tx.companyMember.create({
        data: {
          companyId: company.id,
          userId,
          role: "admin",
          status: "active",
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
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: COMPANY_INCLUDES,
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return company;
  }

  async followCompany(userId: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException("Company not found");
      }

      const existing = await tx.companyFollower.findUnique({
        where: {
          companyId_userId: { companyId, userId },
        },
      });

      if (existing) {
        throw new ConflictException("Already following this company");
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

  async updateCompany(userId: string, companyId: string, data: UpdateCompanyDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException("Company not found");
      }

      const member = await tx.companyMember.findUnique({
        where: {
          companyId_userId: { companyId, userId },
        },
      });

      if (!member || (member.role !== "admin" && member.role !== "owner")) {
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
          ...(data.description !== undefined && { description: data.description }),
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

  async inviteMember(
    userId: string,
    companyId: string,
    data: InviteMemberDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException("Company not found");
      }

      const member = await tx.companyMember.findUnique({
        where: {
          companyId_userId: { companyId, userId },
        },
      });

      if (!member || (member.role !== "admin" && member.role !== "owner")) {
        throw new ForbiddenException(
          "Only company admins or owners can invite members",
        );
      }

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

      const member = await tx.companyMember.create({
        data: {
          companyId: invitation.companyId,
          userId,
          role: invitation.role,
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
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException("Company not found");
      }

      const member = await tx.companyMember.findUnique({
        where: {
          companyId_userId: { companyId, userId },
        },
      });

      if (!member || (member.role !== "admin" && member.role !== "owner")) {
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

      const seat = await tx.recruiterSeat.update({
        where: { id: availableSeat.id },
        data: {
          userId: targetUserId,
          status: "allocated",
          allocatedAt: new Date(),
        },
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

      if (!member || (member.role !== "admin" && member.role !== "owner")) {
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
}
