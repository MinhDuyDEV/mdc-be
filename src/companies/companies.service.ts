import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../infra/prisma/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import type { CreateCompanyDto } from "./dto/create-company.dto";
import type { UpdateCompanyDto } from "./dto/update-company.dto";
import type { InviteMemberDto } from "./dto/invite-member.dto";

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

  // Stub: to be implemented later
  async updateCompany(_userId: string, _id: string, _data: UpdateCompanyDto) {
    throw new BadRequestException("Not yet implemented");
  }

  // Stub: to be implemented later
  async inviteMember(
    _userId: string,
    _companyId: string,
    _data: InviteMemberDto,
  ) {
    throw new BadRequestException("Not yet implemented");
  }

  // Stub: to be implemented later
  async acceptInvitation(_userId: string, _token: string) {
    throw new BadRequestException("Not yet implemented");
  }

  // Stub: to be implemented later
  async allocateRecruiterSeat(
    _userId: string,
    _companyId: string,
    _targetUserId: string,
  ) {
    throw new BadRequestException("Not yet implemented");
  }

  // Stub: to be implemented later
  async deallocateRecruiterSeat(
    _userId: string,
    _companyId: string,
    _seatId: string,
  ) {
    throw new BadRequestException("Not yet implemented");
  }
}
