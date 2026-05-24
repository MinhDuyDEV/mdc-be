import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { OptionalAuth } from '../common/auth/public.decorator';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  async initiateUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateUploadDto,
  ) {
    return this.mediaService.initiateUpload(user, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.mediaService.confirmUpload(user, id);
  }

  @OptionalAuth()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ) {
    return this.mediaService.getDownloadUrl(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.mediaService.deleteAsset(user, id);
  }
}
