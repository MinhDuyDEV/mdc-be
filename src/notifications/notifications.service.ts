import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CursorPaginationMeta } from "../common/pagination/cursor-pagination.dto";
import { PrismaService } from "../infra/prisma/prisma.service";
import {
  decodeCursor,
  encodeCursor,
  buildCursorWhere,
  paginateRows,
} from "../common/pagination/cursor";
import {
  type NotificationResponseDto,
  toNotificationResponse,
} from "./dto/notification.response.dto";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NotificationListResult {
  items: NotificationResponseDto[];
  meta: CursorPaginationMeta;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List notifications for a user with cursor pagination.
   * Ordered by (createdAt DESC, id DESC). Limit clamped to [1, 50].
   */
  async list(userId: string, cursor?: string, limit = 20): Promise<NotificationListResult> {
    const clampedLimit = Math.min(Math.max(limit, 1), 50);

    // Build cursor WHERE clause only when a cursor is provided.
    const cursorWhere = cursor
      ? (() => {
          const decoded = decodeCursor(cursor);
          if (!decoded) throw new BadRequestException("INVALID_CURSOR");
          return buildCursorWhere(decoded);
        })()
      : {};

    const rows = await this.prisma.notification.findMany({
      where: { userId, ...cursorWhere },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: clampedLimit + 1,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, clampedLimit);

    return {
      items: items.map(toNotificationResponse),
      meta: { nextCursor, hasNextPage, limit: clampedLimit },
    };
  }

  /**
   * Count unread notifications for a user.
   * Leverages the partial index notifications_unread_idx (userId WHERE readAt IS NULL).
   */
  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  /**
   * Mark a single notification as read.
   * Returns 404 if not found OR belongs to another user — avoids existence oracle.
   * Idempotent: skips the UPDATE when readAt is already set.
   */
  async markRead(userId: string, notificationId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException("NOTIFICATION_NOT_FOUND");
    }

    // Already read — return as-is without touching the DB.
    if (notification.readAt !== null) {
      return toNotificationResponse(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return toNotificationResponse(updated);
  }

  /**
   * Mark all unread notifications as read for a user.
   * Returns the number of rows updated.
   */
  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { count: result.count };
  }
}
