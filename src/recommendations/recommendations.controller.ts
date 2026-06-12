import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import type {
  DismissDto,
  RecommendationsQueryDto,
  RecommendationsResponseDto,
  RecommendedCompanyDto,
  RecommendedJobDto,
  RecommendedPersonDto,
  SubmitFeedbackDto,
} from './dto';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
@UseGuards(AuthGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('people')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getPeople(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationsQueryDto,
  ): Promise<RecommendationsResponseDto<RecommendedPersonDto>> {
    return this.recommendationsService.getPeopleRecommendations(
      user.id,
      query.cursor,
      query.limit,
    );
  }

  @Get('jobs')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationsQueryDto,
  ): Promise<RecommendationsResponseDto<RecommendedJobDto>> {
    return this.recommendationsService.getJobRecommendations(
      user.id,
      query.cursor,
      query.limit,
    );
  }

  @Get('companies')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getCompanies(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationsQueryDto,
  ): Promise<RecommendationsResponseDto<RecommendedCompanyDto>> {
    return this.recommendationsService.getCompanyRecommendations(
      user.id,
      query.cursor,
      query.limit,
    );
  }

  @Post('feedback')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async submitFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitFeedbackDto,
  ): Promise<{ message: string }> {
    await this.recommendationsService.submitFeedback(user.id, dto);
    return { message: 'Feedback recorded' };
  }

  @Post('dismiss')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DismissDto,
  ): Promise<{ message: string }> {
    await this.recommendationsService.dismissRecommendation(user.id, dto);
    return { message: 'Recommendation dismissed' };
  }
}
