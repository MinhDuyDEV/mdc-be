import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { TrackExperimentDto } from './dto/track-experiment.dto';
import { ExperimentsService } from './experiments.service';

@Controller('experiments')
@UseGuards(AuthGuard)
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post('track')
  async track(
    @Body() dto: TrackExperimentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.experimentsService.trackEvent({
      experimentId: dto.experimentId,
      userId: user.id,
      variant: dto.variant,
    });
    return { success: true };
  }
}
