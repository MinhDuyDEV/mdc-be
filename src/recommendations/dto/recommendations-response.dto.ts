export interface RecommendedPersonDto {
  id: string;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  profilePictureUrl: string | null;
  mutualConnectionCount?: number;
  score: number;
}

export interface RecommendedJobDto {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  employmentType: string;
  workplaceType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  publishedAt: Date | null;
  score: number;
}

export interface RecommendedCompanyDto {
  id: string;
  name: string;
  industry: string | null;
  followerCount: number;
  verified: boolean;
  logoUrl: string | null;
  score: number;
}

export interface RecommendationsResponseDto<T> {
  data: T[];
  meta: {
    nextCursor?: string;
    hasMore: boolean;
    limit: number;
  };
}
