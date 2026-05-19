import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CompaniesService } from "./companies.service";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import { Public } from "../common/auth/public.decorator";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { AllocateRecruiterSeatDto } from "./dto/allocate-recruiter-seat.dto";

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companiesService.createCompany(user.id, dto);
  }

  @Get(":slug")
  @Public()
  @HttpCode(HttpStatus.OK)
  async getCompanyBySlug(@Param("slug") slug: string) {
    return this.companiesService.getCompanyBySlug(slug);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async updateCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(user.id, id, dto);
  }

  @Post(":id/follow")
  @HttpCode(HttpStatus.NO_CONTENT)
  async followCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.companiesService.followCompany(user.id, id);
  }

  @Delete(":id/follow")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollowCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.companiesService.unfollowCompany(user.id, id);
  }

  @Post(":id/members/invite")
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.companiesService.inviteMember(user.id, id, dto);
  }

  @Post("invitations/accept")
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.companiesService.acceptInvitation(user.id, dto.token);
  }

  @Post(":id/recruiter-seats/allocate")
  @HttpCode(HttpStatus.OK)
  async allocateRecruiterSeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AllocateRecruiterSeatDto,
  ) {
    return this.companiesService.allocateRecruiterSeat(user.id, id, dto.userId);
  }

  @Delete(":id/recruiter-seats/:seatId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deallocateRecruiterSeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("seatId") seatId: string,
  ) {
    await this.companiesService.deallocateRecruiterSeat(user.id, id, seatId);
  }
}
