import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/device.dto';

@Controller('devices')
@UseGuards(AuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devicesService.register(user.id, dto);
  }

  @Delete(':id')
  async unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.devicesService.unregister(user.id, id);
    return { message: 'Device unregistered' };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.list(user.id);
  }
}
