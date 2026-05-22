import type {
  ReportCategory,
  ReportEntityType,
  ReportStatus,
} from '@prisma/client';

export interface ReportResponseDto {
  id: string;
  reporterId: string;
  targetEntity: ReportEntityType;
  targetId: string;
  category: ReportCategory;
  description: string | null;
  status: ReportStatus;
  priority: number;
  assignedToId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
