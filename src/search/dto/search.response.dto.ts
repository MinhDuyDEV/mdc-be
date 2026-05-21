export interface SearchHitDto {
  id: string;
  type: 'profile' | 'company' | 'job' | 'post';
  score: number;
  data: Record<string, unknown>;
  highlights?: Record<string, string[]>;
}

export interface SearchResponseDto {
  data: SearchHitDto[];
  meta: {
    total: number;
    nextCursor?: string;
    hasNextPage: boolean;
    took: number;
    engine: 'elasticsearch' | 'postgres';
  };
}
