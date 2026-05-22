import type { CursorPaginationMeta } from '../../common/pagination/cursor-pagination.dto';

export interface RecommendedPersonDto {
  id: string;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  profilePictureUrl: string | null;
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
}

export interface RecommendedCompanyDto {
  id: string;
  name: string;
  industry: string | null;
  followerCount: number;
  verified: boolean;
  logoUrl: string | null;
}

export interface RecommendationsResponseDto<T> {
  data: T[];
  meta: CursorPaginationMeta;
}
