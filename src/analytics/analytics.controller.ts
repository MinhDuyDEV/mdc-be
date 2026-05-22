import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { OptionalAuth } from '../common/auth/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import type { RecordEventDto } from './dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Post('events')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @OptionalAuth()
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
    void this.service.recordEvent(dto, userId, ip, userAgent);
    return { data: { success: true } };
  }

  @Get('dashboard')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('VIEW_ANALYTICS')
  async getDashboard() {
    const metrics = await this.service.getDashboardMetrics();
    return { data: metrics };
  }

  @Get('entity/:type/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('VIEW_ANALYTICS')
  async getEntityAnalytics(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const analytics = await this.service.getEntityAnalytics(type, id);
    return { data: analytics };
  }
}
