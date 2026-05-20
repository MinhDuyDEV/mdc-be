import type { PostStatus, PostVisibility } from '@prisma/client';

export interface PostResponseDto {
  id: string;
  authorId: string;
  content: string;
  visibility: PostVisibility;
  status: PostStatus;
  commentCount: number;
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author?: {
    id: string;
    email: string;
    profile?: {
      firstName: string | null;
      lastName: string | null;
      headline: string | null;
    };
  };
  hashtags?: Array<{ hashtag: { name: string } }>;
  media?: Array<{ mediaAsset: { id: string; url: string; type: string } }>;
}
