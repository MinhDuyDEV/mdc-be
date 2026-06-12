import { IsIn, IsUUID } from 'class-validator';

export const RECOMMENDATION_ENTITY_TYPES = [
  'person',
  'job',
  'company',
] as const;
export type RecommendationEntityType =
  (typeof RECOMMENDATION_ENTITY_TYPES)[number];

export const RECOMMENDATION_FEEDBACK_VALUES = [
  'helpful',
  'not_helpful',
  'irrelevant',
] as const;
export type RecommendationFeedbackValue =
  (typeof RECOMMENDATION_FEEDBACK_VALUES)[number];

export class SubmitFeedbackDto {
  @IsIn(RECOMMENDATION_ENTITY_TYPES)
  entityType!: RecommendationEntityType;

  @IsUUID()
  entityId!: string;

  @IsIn(RECOMMENDATION_FEEDBACK_VALUES)
  feedback!: RecommendationFeedbackValue;
}

export class DismissDto {
  @IsIn(RECOMMENDATION_ENTITY_TYPES)
  entityType!: RecommendationEntityType;

  @IsUUID()
  entityId!: string;
}
