import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ReportStatus } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type {
  CreateModerationActionDto,
  CreateReportDto,
  ReportResponseDto,
} from './dto';
import type { ModerationService } from './moderation.service';

@Controller('moderation')
export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  @Post('reports')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ReportResponseDto }> {
    const report = await this.service.createReport(dto, user.id);
    return { data: report };
  }

  @Get('reports')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  async listReports(
    @Query('status') status?: ReportStatus,
  ): Promise<{ data: ReportResponseDto[] }> {
    const reports = await this.service.listReports(status);
    return { data: reports };
  }

  @Patch('reports/:id/claim')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  async claimReport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ReportResponseDto }> {
    const report = await this.service.claimReport(id, user.id);
    return { data: report };
  }

  @Post('actions')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  async applyAction(
    @Body() dto: CreateModerationActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { success: boolean } }> {
    await this.service.applyModerationAction(dto, user.id);
    return { data: { success: true } };
  }
}
