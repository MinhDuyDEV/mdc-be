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
import type { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import type {
  AddCandidateToPoolDto,
  SaveCandidateDto,
} from './dto/save-candidate.dto';
import type {
  CreateTalentPoolDto,
  UpdateTalentPoolDto,
} from './dto/talent-pool.dto';
import type { RecruitingService } from './recruiting.service';

@Controller('companies/:companyId')
export class RecruitingController {
  constructor(private readonly recruitingService: RecruitingService) {}

  // ─────────────────────── Saved candidates ───────────────────────────────

  @Post('saved-candidates')
  @HttpCode(HttpStatus.CREATED)
  async saveCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: SaveCandidateDto,
  ) {
    return this.recruitingService.saveCandidate(user.id, companyId, dto);
  }

  @Delete('saved-candidates/:candidateUserId')
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

  @Get('saved-candidates')
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

  @Post('talent-pools')
  @HttpCode(HttpStatus.CREATED)
  async createTalentPool(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTalentPoolDto,
  ) {
    return this.recruitingService.createTalentPool(user.id, companyId, dto);
  }

  @Get('talent-pools')
  async listTalentPools(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.recruitingService.listTalentPools(user.id, companyId);
  }

  @Patch('talent-pools/:poolId')
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

  @Delete('talent-pools/:poolId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTalentPool(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('poolId', ParseUUIDPipe) poolId: string,
  ) {
    await this.recruitingService.deleteTalentPool(user.id, companyId, poolId);
  }

  @Post('talent-pools/:poolId/candidates')
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

  @Delete('talent-pools/:poolId/candidates/:candidateUserId')
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
}
