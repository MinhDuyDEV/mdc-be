import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsRepository } from './recommendations.repository';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [InfraModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationsRepository],
})
export class RecommendationsModule {}
