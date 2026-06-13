import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { OptionalAuth, Public } from '../common/auth/public.decorator';
import { CompanyRole } from '../common/decorators/company-role.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { CompanyRoleGuard } from '../common/guards/company-role.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingService } from './billing.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { StripeProrationService } from './proration/stripe-proration.service';

@Controller()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly stripeProrationService: StripeProrationService,
  ) {}

  // ── Plans ────────────────────────────────────────────────────────────

  @Get('billing/plans')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  async listPlans(@CurrentUser() user?: AuthenticatedUser) {
    const isAdmin = user?.roles?.includes('admin') ?? false;
    return this.billingService.listPlans(isAdmin);
  }

  @Get('billing/plans/:planId')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getPlan(@Param('planId', ParseUUIDPipe) planId: string) {
    return this.billingService.getPlan(planId);
  }

  @Post('admin/billing/plans')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Patch('admin/billing/plans/:planId')
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
    @Query('atPeriodEnd', new ParseBoolPipe({ optional: true }))
    atPeriodEnd?: boolean,
  ) {
    return this.billingService.cancelSubscription(
      companyId,
      atPeriodEnd ?? true,
    );
  }

  @Post('companies/:companyId/subscription/change-plan')
  @UseGuards(CompanyRoleGuard, EmailVerifiedGuard)
  @CompanyRole('OWNER')
  @VerifiedEmail()
  @HttpCode(HttpStatus.OK)
  async changePlan(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: ChangePlanDto,
  ) {
    // Resolve proration behavior: explicit value wins, then legacy atPeriodEnd
    const prorationBehavior =
      dto.prorationBehavior ??
      (dto.atPeriodEnd === false ? 'always_invoice' : 'none');
    const idempotencyKey = `${companyId}:${dto.planId}:${prorationBehavior}`;

    // always_invoice / create_prorations → upgrade (immediate charge)
    // none → downgrade (scheduled at period end)
    if (
      prorationBehavior === 'always_invoice' ||
      prorationBehavior === 'create_prorations'
    ) {
      return this.stripeProrationService.upgrade(
        companyId,
        dto.planId,
        idempotencyKey,
        prorationBehavior,
      );
    }
    return this.stripeProrationService.downgrade(
      companyId,
      dto.planId,
      idempotencyKey,
    );
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
