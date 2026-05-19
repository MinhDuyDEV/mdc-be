import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateJobDto } from "./create-job.dto.js";

/**
 * All CreateJobDto fields are optional except companyId which is omitted —
 * a job cannot be moved between companies after creation.
 */
export class UpdateJobDto extends PartialType(
	OmitType(CreateJobDto, ["companyId"] as const),
) {}
