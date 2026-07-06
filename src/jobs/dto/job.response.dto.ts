import type {
  ApplyMode,
  EmploymentType,
  Job,
  JobSkill,
  JobStatus,
  ScreeningQuestion,
  WorkplaceType,
} from '@prisma/client';
import type { ScreeningQuestionResponseDto } from './screening-question.dto';

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
  requireResume!: boolean;
  publishedAt!: Date | null;
  closedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  /** Skill IDs attached to this job. */
  skills!: string[];
  /** Screening questions defined on this job. Empty array when none. */
  screeningQuestions!: ScreeningQuestionResponseDto[];
  /**
   * `true`/`false` when the caller is authenticated and the saved state is
   * known; `null` for anonymous callers (no auth context to evaluate).
   */
  isSaved!: boolean | null;
  /**
   * `true`/`false` when the caller is authenticated; `null` for anonymous.
   */
  isApplied!: boolean | null;
}

type JobWithSkills = Job & { skills: JobSkill[] };

/**
 * Enrichment data computed by the service for the *current* caller.
 * Anonymous callers pass nothing (all flags resolve to `null`).
 */
export interface JobResponseEnrichment {
  screeningQuestions?: ScreeningQuestion[];
  isSaved?: boolean;
  isApplied?: boolean;
}

function toScreeningQuestionResponseDto(
  q: ScreeningQuestion,
): ScreeningQuestionResponseDto {
  return {
    id: q.id,
    question: q.question,
    type: q.type,
    required: q.required,
    options: q.options,
    position: q.position,
  };
}

/**
 * Maps a Prisma Job row (with skills included) to the public response shape.
 * Excludes: searchVector, createdByUserId, deletedAt.
 *
 * Pass `enrichment` for an authenticated caller to populate
 * `screeningQuestions`, `isSaved`, and `isApplied`. Omit it for anonymous
 * callers — those fields default to `null` / empty.
 */
export function toJobResponseDto(
  job: JobWithSkills,
  enrichment?: JobResponseEnrichment,
): JobResponseDto {
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
    requireResume: job.requireResume,
    publishedAt: job.publishedAt ?? null,
    closedAt: job.closedAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    skills: job.skills.map((s) => s.skillId),
    screeningQuestions: (enrichment?.screeningQuestions ?? []).map(
      toScreeningQuestionResponseDto,
    ),
    isSaved: enrichment?.isSaved ?? null,
    isApplied: enrichment?.isApplied ?? null,
  };
}
