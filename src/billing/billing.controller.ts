import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import { Public } from "../common/auth/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { BillingService } from "./billing.service";
import type { CreatePlanDto } from "./dto/create-plan.dto";
import type { UpdatePlanDto } from "./dto/update-plan.dto";

@Controller("billing")
export class BillingController {
	constructor(private readonly billingService: BillingService) {}

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

	@Patch("admin/plans/:planId")
	@UseGuards(RolesGuard)
	@Roles("admin")
	@HttpCode(HttpStatus.OK)
	async updatePlan(
		@Param('planId', ParseUUIDPipe) planId: string,
		@Body() dto: UpdatePlanDto,
	) {
		return this.billingService.updatePlan(planId, dto);
	}
}
