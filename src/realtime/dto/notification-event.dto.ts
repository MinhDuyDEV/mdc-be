export class NotificationEventDto {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  createdAt: Date;
}
