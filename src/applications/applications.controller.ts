import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import type { CursorPaginationQueryDto } from "../common/pagination/cursor-pagination.dto";
import { MediaService } from "../media/media.service";
import { ApplicationsService } from "./applications.service";
import type { CreateApplicationNoteDto } from "./dto/application-note.dto";
import type { SubmitApplicationDto } from "./dto/submit-application.dto";
import type { UpdateApplicationStatusDto } from "./dto/update-status.dto";

/**
 * Applications API.
 *
 * The candidate-facing routes live under /applications, except submit + the
 * employer review list which are nested under /jobs/:jobId/applications.
 *
 * NOTE: We declare both controller-shape patterns in a single class for now;
 * NestJS routes are determined per-method by the @Get/@Post path arg.
 */
@Controller()
export class ApplicationsController {
	constructor(
    private readonly applicationsService: ApplicationsService,
    @Inject(MediaService) private readonly mediaService: MediaService,
  ) {}

	// ──────────────────────────── Submit / list (job-scoped) ────────────────

	@Post("jobs/:jobId/applications")
	@HttpCode(HttpStatus.CREATED)
	async submit(
		@CurrentUser() user: AuthenticatedUser,
		@Param("jobId", ParseUUIDPipe) jobId: string,
		@Body() dto: SubmitApplicationDto,
	) {
		return this.applicationsService.submitApplication(user.id, jobId, dto);
	}

	@Get("jobs/:jobId/applications")
	async listForJob(
		@CurrentUser() user: AuthenticatedUser,
		@Param("jobId", ParseUUIDPipe) jobId: string,
		@Query() query: CursorPaginationQueryDto,
	) {
		return this.applicationsService.listEmployerApplications(
			user.id,
			jobId,
			query,
		);
	}

	// ──────────────────────────── Candidate-scoped ──────────────────────────

	@Get("applications/me")
	async listMine(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: CursorPaginationQueryDto,
	) {
		return this.applicationsService.listMyApplications(user.id, query);
	}

	// ──────────────────────────── Single application ────────────────────────

	@Get("applications/:id")
	async getOne(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.applicationsService.getApplication(user.id, id);
	}

	@Patch("applications/:id/status")
	async updateStatus(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateApplicationStatusDto,
	) {
		return this.applicationsService.updateStatus(user.id, id, dto);
	}

	@Post("applications/:id/withdraw")
	async withdraw(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.applicationsService.withdraw(user.id, id);
	}

	// ──────────────────────────── Notes ─────────────────────────────────────

	@Post("applications/:id/notes")
	@HttpCode(HttpStatus.CREATED)
	async addNote(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: CreateApplicationNoteDto,
	) {
		return this.applicationsService.addNote(user.id, id, dto);
	}

	@Get("applications/:id/notes")
	async listNotes(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.applicationsService.listNotes(user.id, id);
	}

	// ──────────────────────────── Resume URL ────────────────────────────────

	@Get("applications/:id/resume-url")
	async getResumeUrl(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		const access = await this.applicationsService.getResumeAccess(user.id, id);
		// MediaService.getDownloadUrl enforces ownership against the caller.
		// For employer access the asset belongs to the candidate, so we call
		// MediaService with the candidate's identity context to obtain the URL.
		const ownerCtx = {
			id: access.ownerUserId,
			email: "",
		} as AuthenticatedUser;
		const url = await this.mediaService.getDownloadUrl(
			ownerCtx,
			access.mediaAssetId,
		);
		return {
			applicationId: access.applicationId,
			mediaAssetId: access.mediaAssetId,
			...url,
		};
	}
}
