import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { type Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  live() {
    return this.healthService.live();
  }

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
