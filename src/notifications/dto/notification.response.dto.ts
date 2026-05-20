import type { Notification } from '@prisma/client';

export class NotificationResponseDto {
  id!: string;
  type!: string;
  title!: string | null;
  body!: string | null;
  actionUrl!: string | null;
  /** Exposed as `payload` (not `payloadJson`) */
  payload!: Record<string, unknown> | null;
  readAt!: string | null; // ISO 8601
  createdAt!: string; // ISO 8601
}

export function toNotificationResponse(
  n: Notification,
): NotificationResponseDto {
  const dto = new NotificationResponseDto();
  dto.id = n.id;
  dto.type = n.type;
  dto.title = n.title ?? null;
  dto.body = n.body ?? null;
  dto.actionUrl = n.actionUrl ?? null;
  dto.payload = n.payloadJson as Record<string, unknown> | null;
  dto.readAt = n.readAt?.toISOString() ?? null;
  dto.createdAt = n.createdAt.toISOString();
  return dto;
}
