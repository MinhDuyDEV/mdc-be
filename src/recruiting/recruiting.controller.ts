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
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import type {
  AddCandidateToPoolDto,
  SaveCandidateDto,
} from './dto/save-candidate.dto';
import type {
  CreateTalentPoolDto,
  UpdateTalentPoolDto,
} from './dto/talent-pool.dto';
import type { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import type { UpdateInterviewDto } from './dto/update-interview.dto';
import type { SubmitScorecardDto } from './dto/submit-scorecard.dto';
import type { CreateOfferDto } from './dto/create-offer.dto';
import type { RespondOfferDto } from './dto/respond-offer.dto';
import { RecruitingService } from './recruiting.service';

@Controller()
export class RecruitingController {
  constructor(private readonly recruitingService: RecruitingService) {}

  // ─────────────────────── Saved candidates ───────────────────────────────

  @Post('companies/:companyId/saved-candidates')
  @HttpCode(HttpStatus.CREATED)
  async saveCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: SaveCandidateDto,
  ) {
    return this.recruitingService.saveCandidate(user.id, companyId, dto);
  }

  @Delete('companies/:companyId/saved-candidates/:candidateUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsaveCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('candidateUserId', ParseUUIDPipe) candidateUserId: string,
  ) {
    await this.recruitingService.unsaveCandidate(
      user.id,
      companyId,
      candidateUserId,
    );
  }

  @Get('companies/:companyId/saved-candidates')
  async listSavedCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.recruitingService.listSavedCandidates(
      user.id,
      companyId,
      query,
    );
  }

  // ─────────────────────── Talent pools ───────────────────────────────────

  @Post('companies/:companyId/talent-pools')
  @HttpCode(HttpStatus.CREATED)
  async createTalentPool(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTalentPoolDto,
  ) {
    return this.recruitingService.createTalentPool(user.id, companyId, dto);
  }

  @Get('companies/:companyId/talent-pools')
  async listTalentPools(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.recruitingService.listTalentPools(user.id, companyId);
  }

  @Patch('companies/:companyId/talent-pools/:poolId')
  async updateTalentPool(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('poolId', ParseUUIDPipe) poolId: string,
    @Body() dto: UpdateTalentPoolDto,
  ) {
    return this.recruitingService.updateTalentPool(
      user.id,
      companyId,
      poolId,
      dto,
    );
  }

  @Delete('companies/:companyId/talent-pools/:poolId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTalentPool(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('poolId', ParseUUIDPipe) poolId: string,
  ) {
    await this.recruitingService.deleteTalentPool(user.id, companyId, poolId);
  }

  @Post('companies/:companyId/talent-pools/:poolId/candidates')
  @HttpCode(HttpStatus.CREATED)
  async addCandidateToPool(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('poolId', ParseUUIDPipe) poolId: string,
    @Body() dto: AddCandidateToPoolDto,
  ) {
    return this.recruitingService.addCandidateToPool(
      user.id,
      companyId,
      poolId,
      dto,
    );
  }

  @Delete(
    'companies/:companyId/talent-pools/:poolId/candidates/:candidateUserId',
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCandidateFromPool(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('poolId', ParseUUIDPipe) poolId: string,
    @Param('candidateUserId', ParseUUIDPipe) candidateUserId: string,
  ) {
    await this.recruitingService.removeCandidateFromPool(
      user.id,
      companyId,
      poolId,
      candidateUserId,
    );
  }

  // ─────────────────────── Interview Scheduling (W2-T9) ───────────────────

  @Post('companies/:companyId/interviews')
  @HttpCode(HttpStatus.CREATED)
  async scheduleInterview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: ScheduleInterviewDto,
  ) {
    return this.recruitingService.scheduleInterview(user.id, companyId, dto);
  }

  @Get('companies/:companyId/interviews')
  async listInterviews(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: CursorPaginationQueryDto & { applicationId?: string },
  ) {
    return this.recruitingService.listInterviews(user.id, companyId, query);
  }

  @Patch('companies/:companyId/interviews/:id')
  async updateInterview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.recruitingService.updateInterview(
      user.id,
      companyId,
      interviewId,
      dto,
    );
  }

  @Post('companies/:companyId/interviews/:id/interviewers')
  @HttpCode(HttpStatus.CREATED)
  async addInterviewer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Body() body: { userId: string },
  ) {
    return this.recruitingService.addInterviewer(
      user.id,
      companyId,
      interviewId,
      body.userId,
    );
  }

  // ─────────────────────── Scorecard System (W2-T10) ─────────────────────

  @Post('companies/:companyId/scorecards')
  @HttpCode(HttpStatus.CREATED)
  async submitScorecard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: SubmitScorecardDto,
  ) {
    return this.recruitingService.submitScorecard(user.id, companyId, dto);
  }

  @Get('companies/:companyId/scorecards')
  async listScorecards(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query()
    query: CursorPaginationQueryDto & {
      interviewId?: string;
      applicationId?: string;
    },
  ) {
    return this.recruitingService.listScorecards(user.id, companyId, query);
  }

  // ─────────────────────── Offer Workflow (W2-T11) ───────────────────────

  @Post('companies/:companyId/offers')
  @HttpCode(HttpStatus.CREATED)
  async createOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.recruitingService.createOffer(user.id, companyId, dto);
  }

  @Post('companies/:companyId/offers/:id/send')
  @HttpCode(HttpStatus.CREATED)
  async sendOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) offerId: string,
  ) {
    return this.recruitingService.sendOffer(user.id, companyId, offerId);
  }

  @Post('offers/:id/respond')
  @HttpCode(HttpStatus.CREATED)
  async respondToOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) offerId: string,
    @Body() dto: RespondOfferDto,
  ) {
    return this.recruitingService.respondToOffer(
      user.id,
      offerId,
      dto.accepted,
    );
  }
}
