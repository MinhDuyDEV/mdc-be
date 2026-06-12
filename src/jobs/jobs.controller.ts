import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Public } from '../common/auth/public.decorator';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';
import { ListJobsQueryDto } from './dto/list-jobs.query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateSavedSearchDto } from './dto/update-saved-search.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  @HttpCode(HttpStatus.CREATED)
  async createJob(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.createJob(user.id, dto);
  }

  @Get()
  @Public()
  async listJobs(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListJobsQueryDto,
  ) {
    return this.jobsService.listJobs(query, user?.id);
  }

  /**
   * Static path declared BEFORE :id so NestJS does not treat "saved" as :id.
   */
  @Get('saved')
  async listSavedJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.jobsService.listSavedJobs(user.id, query);
  }

  @Post('saved-searches')
  @HttpCode(HttpStatus.CREATED)
  async createSavedSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedSearchDto,
  ) {
    return this.jobsService.createSavedSearch(user.id, dto);
  }

  @Get('saved-searches')
  async listSavedSearches(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.jobsService.listSavedSearches(user.id, query);
  }

  @Patch('saved-searches/:id')
  async updateSavedSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedSearchDto,
  ) {
    return this.jobsService.updateSavedSearch(user.id, id, dto);
  }

  @Delete('saved-searches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSavedSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.jobsService.deleteSavedSearch(user.id, id);
  }

  @Get(':id')
  @Public()
  async getJob(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobsService.getJob(id, user?.id);
  }

  @Patch(':id')
  async updateJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.updateJob(user.id, id, dto);
  }

  @Post(':id/publish')
  @UseGuards(EmailVerifiedGuard)
  @VerifiedEmail()
  async publishJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobsService.publishJob(user.id, id);
  }

  @Post(':id/close')
  async closeJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobsService.closeJob(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.jobsService.deleteJob(user.id, id);
  }

  @Post(':id/save')
  @HttpCode(HttpStatus.CREATED)
  async saveJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobsService.saveJob(user.id, id);
  }

  @Delete(':id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsaveJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.jobsService.unsaveJob(user.id, id);
  }

  @Post(':id/external-apply-click')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async externalApplyClick(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.jobsService.recordExternalApplyClick(id, user?.id);
  }
}
