import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('live')
  live() {
    return this.healthService.live();
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.healthService.ready();
    if (result.status === 'error') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
