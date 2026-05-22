import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AnalyticsService } from './analytics.service';
import type { RecordEventDto } from './dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Post('events')
  recordEvent(
    @Body() dto: RecordEventDto,
    @CurrentUser('id') userId: string | null,
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.socket.remoteAddress || '').replace(
      '::ffff:',
      '',
    );
    const userAgent = req.headers['user-agent'] || '';
    this.service.recordEvent(dto, userId, ip, userAgent);
    return { data: { success: true } };
  }

  @Get('dashboard')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getDashboard() {
    const metrics = await this.service.getDashboardMetrics();
    return { data: metrics };
  }

  @Get('entity/:type/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getEntityAnalytics(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    const analytics = await this.service.getEntityAnalytics(type, id);
    return { data: analytics };
  }
}
