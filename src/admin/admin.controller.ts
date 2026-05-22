import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AdminService } from './admin.service';
import type {
  AdminCompanyQueryDto,
  AdminJobQueryDto,
  AdminUserQueryDto,
  UpdateUserStatusDto,
  VerifyCompanyDto,
} from './dto';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  async listUsers(@Query() query: AdminUserQueryDto) {
    return this.service.listUsers(query);
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    await this.service.updateUserStatus(id, dto, adminId);
    return { data: { success: true } };
  }

  @Get('companies')
  async listCompanies(@Query() query: AdminCompanyQueryDto) {
    return this.service.listCompanies(query);
  }

  @Patch('companies/:id/verification')
  async verifyCompany(
    @Param('id') id: string,
    @Body() dto: VerifyCompanyDto,
    @CurrentUser('id') adminId: string,
  ) {
    await this.service.verifyCompany(id, dto, adminId);
    return { data: { success: true } };
  }

  @Get('jobs')
  async listJobs(@Query() query: AdminJobQueryDto) {
    return this.service.listJobs(query);
  }
}
