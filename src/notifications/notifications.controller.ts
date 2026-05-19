import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import type { CursorPaginationQueryDto } from "../common/pagination/cursor-pagination.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
	constructor(private readonly notificationsService: NotificationsService) {}

	/**
	 * GET /api/v1/notifications
	 * Cursor-paginated list of the caller's notifications (newest first).
	 * Returns { data: NotificationResponseDto[], meta: CursorPaginationMeta }.
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	async list(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: CursorPaginationQueryDto,
	) {
		const result = await this.notificationsService.list(
			user.id,
			query.cursor,
			query.limit,
		);
		// Return { data, meta } directly — ApiResponseInterceptor detects the
		// `data` key and passes it through without double-wrapping.
		return { data: result.items, meta: result.meta };
	}

	/**
	 * GET /api/v1/notifications/unread-count
	 * Returns { data: { count: number } } after interceptor wrapping.
	 */
	@Get("unread-count")
  @HttpCode(HttpStatus.OK)
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notificationsService.unreadCount(user.id);
    return { count };
  }

	/**
	 * PATCH /api/v1/notifications/:id/read
	 * Mark a single notification as read.
	 * Returns 404 if not found or owned by another user (no existence oracle).
	 */
	@Patch(":id/read")
	@HttpCode(HttpStatus.OK)
	async markRead(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
	) {
		return this.notificationsService.markRead(user.id, id);
	}

	/**
	 * POST /api/v1/notifications/read-all
	 * Mark all unread notifications as read for the caller.
	 * Returns { data: { count: number } } after interceptor wrapping.
	 */
	@Post("read-all")
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
