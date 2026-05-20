import type {
  ApplyMode,
  EmploymentType,
  Job,
  JobSkill,
  JobStatus,
  WorkplaceType,
} from '@prisma/client';

export class JobResponseDto {
  id!: string;
  companyId!: string;
  title!: string;
  description!: string;
  applyMode!: ApplyMode;
  applyUrl!: string | null;
  status!: JobStatus;
  employmentType!: EmploymentType;
  workplaceType!: WorkplaceType;
  location!: string | null;
  salaryMin!: number | null;
  salaryMax!: number | null;
  salaryCurrency!: string | null;
  publishedAt!: Date | null;
  closedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  /** Skill IDs attached to this job. */
  skills!: string[];
}

type JobWithSkills = Job & { skills: JobSkill[] };

/**
 * Maps a Prisma Job row (with skills included) to the public response shape.
 * Excludes: searchVector, createdByUserId, deletedAt.
 */
export function toJobResponseDto(job: JobWithSkills): JobResponseDto {
  return {
    id: job.id,
    companyId: job.companyId,
    title: job.title,
    description: job.description,
    applyMode: job.applyMode,
    applyUrl: job.applyUrl ?? null,
    status: job.status,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    location: job.location ?? null,
    salaryMin:
      job.salaryMin !== null && job.salaryMin !== undefined
        ? Number(job.salaryMin)
        : null,
    salaryMax:
      job.salaryMax !== null && job.salaryMax !== undefined
        ? Number(job.salaryMax)
        : null,
    salaryCurrency: job.salaryCurrency ?? null,
    publishedAt: job.publishedAt ?? null,
    closedAt: job.closedAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    skills: job.skills.map((s) => s.skillId),
  };
}
