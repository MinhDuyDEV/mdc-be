import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { PrismaService } from '../infra/prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { GdprService } from './gdpr.service';
import { DataExportService } from './data-export.service';
import { DeletionRequestService } from './deletion-request.service';
import type { CreateDeletionRequestDto } from './dto';

@Controller('gdpr')
@UseGuards(AuthGuard)
export class GdprController {
  constructor(
    private readonly gdprService: GdprService,
    private readonly dataExportService: DataExportService,
    private readonly deletionRequestService: DeletionRequestService,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  // Self-service data export
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestExport(@CurrentUser() user: AuthenticatedUser) {
    const exportId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await this.outboxService.emit(tx, {
        eventType: 'UserDataExportRequested',
        aggregateType: 'User',
        aggregateId: user.id,
        payload: {
          exportId,
          userId: user.id,
          requestedBy: user.id,
          requestedAt: new Date().toISOString(),
        },
      });
    });
    return { exportId, status: 'PENDING' };
  }

  // Get deletion request status
  @Get('requests/:id')
  @HttpCode(HttpStatus.OK)
  async getRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const request = await this.deletionRequestService.findById(id);
    if (!request) throw new NotFoundException('Deletion request not found');
    if (request.userId !== user.id && !user.roles?.includes('admin')) {
      throw new ForbiddenException();
    }
    return request;
  }

  // Self-service deletion request
  @Post('delete')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDeletionRequestDto,
  ) {
    const request = await this.gdprService.requestOwnDeletion(
      user.id,
      dto.reason,
    );
    return {
      id: request.id,
      status: request.status,
      scheduledFor: request.scheduledFor,
      dueBy: request.dueBy,
    };
  }

  // Cancel pending deletion
  @Post('cancel/:requestId')
  @HttpCode(HttpStatus.OK)
  async cancelDeletion(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.gdprService.cancelDeletion(requestId, user.id);
    return { success: true };
  }
}
