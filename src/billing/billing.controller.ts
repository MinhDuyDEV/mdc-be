import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Public } from '../common/auth/public.decorator';
import { CompanyRole } from '../common/decorators/company-role.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { CompanyRoleGuard } from '../common/guards/company-role.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingService } from './billing.service';
import type { CreatePlanDto } from './dto/create-plan.dto';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import type { ListInvoicesDto } from './dto/list-invoices.dto';
import type { UpdatePlanDto } from './dto/update-plan.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── Plans ────────────────────────────────────────────────────────────

  @Get('plans')
  @Public()
  @HttpCode(HttpStatus.OK)
  async listPlans(@CurrentUser() user?: AuthenticatedUser) {
    const isAdmin = user?.roles?.includes('admin') ?? false;
    return this.billingService.listPlans(isAdmin);
  }

  @Get('plans/:planId')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getPlan(@Param('planId', ParseUUIDPipe) planId: string) {
    return this.billingService.getPlan(planId);
  }

  @Post('admin/plans')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Patch('admin/plans/:planId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async updatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.billingService.updatePlan(planId, dto);
  }

  // ── Subscriptions ────────────────────────────────────────────────────

  @Post('companies/:companyId/subscription')
  @UseGuards(CompanyRoleGuard, EmailVerifiedGuard)
  @CompanyRole('OWNER')
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.billingService.createSubscription(companyId, user.id, dto);
  }

  @Get('companies/:companyId/subscription')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getSubscription(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.billingService.getSubscription(companyId);
  }

  @Delete('companies/:companyId/subscription')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.billingService.cancelSubscription(companyId);
  }

  // ── Invoices ─────────────────────────────────────────────────────────

  @Get('companies/:companyId/invoices')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.OK)
  async listInvoices(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListInvoicesDto,
  ) {
    return this.billingService.listInvoices(companyId, query);
  }

  @Get('companies/:companyId/invoices/:invoiceId')
  @UseGuards(CompanyRoleGuard)
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getInvoice(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billingService.getInvoice(companyId, invoiceId);
  }
}
