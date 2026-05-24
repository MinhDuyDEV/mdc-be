import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Public } from '../common/auth/public.decorator';
import { CompanyRole } from '../common/decorators/company-role.decorator';
import { CompanyRoleGuard } from '../common/guards/company-role.guard';
import {
  IdempotencyKeyInterceptor,
  IdempotentRequest,
} from '../common/idempotency';
import { CompaniesService } from './companies.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AllocateRecruiterSeatDto } from './dto/allocate-recruiter-seat.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @IdempotentRequest('CompaniesController.createCompany')
  @UseInterceptors(IdempotencyKeyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async createCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companiesService.createCompany(user.id, dto);
  }

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async listCompanies(@Query() query: ListCompaniesDto) {
    return this.companiesService.listCompanies(query);
  }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getCompanyById(@Param('id') id: string) {
    return this.companiesService.getCompanyById(id);
  }

  @Get('by-slug/:slug')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getCompanyBySlug(@Param('slug') slug: string) {
    return this.companiesService.getCompanyBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(user.id, id, dto);
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  async followCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.companiesService.followCompany(user.id, id);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollowCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.companiesService.unfollowCompany(user.id, id);
  }

  @Post(':id/members')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.companiesService.addMember(user.id, id, dto);
  }

  @Get(':id/members')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN', 'MEMBER')
  @HttpCode(HttpStatus.OK)
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ListCompaniesDto,
  ) {
    return this.companiesService.listMembers(user.id, id, query);
  }

  @Patch(':id/members/:memberId')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.companiesService.updateMemberRole(user.id, id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    await this.companiesService.removeMember(user.id, id, memberId);
  }

  @Post(':id/members/invite')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.companiesService.inviteMember(user.id, id, dto);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.companiesService.acceptInvitation(user.id, dto.token);
  }

  @Post(':id/recruiter-seats/allocate')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async allocateRecruiterSeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AllocateRecruiterSeatDto,
  ) {
    return this.companiesService.allocateRecruiterSeat(user.id, id, dto.userId);
  }

  @Delete(':id/recruiter-seats/:seatId')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deallocateRecruiterSeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('seatId') seatId: string,
  ) {
    await this.companiesService.deallocateRecruiterSeat(user.id, id, seatId);
  }
}
