import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'System',
    payloadJson: { key: 'value' },
    title: 'Test title',
    body: 'Test body',
    actionUrl: null,
    readAt: null,
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    ...overrides,
  };
}

function makeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}:${id}`).toString('base64url');
}

function createService() {
  const mockPrisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new NotificationsService(mockPrisma as any);
  return { service, mockPrisma };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationsService', () => {
  describe('list', () => {
    it('returns items and nextCursor when more results exist (limit+1 rows)', async () => {
      const { service, mockPrisma } = createService();
      const rows = [
        makeNotification({
          id: 'n1',
          createdAt: new Date('2024-01-15T10:00:00.000Z'),
        }),
        makeNotification({
          id: 'n2',
          createdAt: new Date('2024-01-14T10:00:00.000Z'),
        }),
        makeNotification({
          id: 'n3',
          createdAt: new Date('2024-01-13T10:00:00.000Z'),
        }),
      ];
      mockPrisma.notification.findMany.mockResolvedValue(rows);

      const result = await service.list('user-1', undefined, 2);

      expect(result.items).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
    });

    it('returns no nextCursor when results are within limit', async () => {
      const { service, mockPrisma } = createService();
      mockPrisma.notification.findMany.mockResolvedValue([
        makeNotification({ id: 'n1' }),
        makeNotification({ id: 'n2' }),
      ]);

      const result = await service.list('user-1', undefined, 5);

      expect(result.items).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.nextCursor).toBeUndefined();
    });

    it('decodes cursor and applies compound (createdAt < x OR (createdAt = x AND id < y)) clause', async () => {
      const { service, mockPrisma } = createService();
      const cursorDate = new Date('2024-01-15T10:00:00.000Z');
      const cursorId = 'notif-abc';
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await service.list('user-1', makeCursor(cursorDate, cursorId), 20);

      const callArgs = mockPrisma.notification.findMany.mock.calls[0][0];

      expect(callArgs.where.OR).toBeDefined();

      expect(callArgs.where.OR[0]).toEqual({ createdAt: { lt: cursorDate } });

      expect(callArgs.where.OR[1]).toEqual({
        createdAt: cursorDate,
        id: { lt: cursorId },
      });
    });

    it('throws BadRequestException on malformed cursor', async () => {
      const { service } = createService();

      await expect(
        service.list('user-1', 'not!!valid!!base64', 20),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unreadCount', () => {
    it('returns the count of unread notifications from prisma', async () => {
      const { service, mockPrisma } = createService();
      mockPrisma.notification.count.mockResolvedValue(7);

      const count = await service.unreadCount('user-1');

      expect(count).toBe(7);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException when notification is not found or belongs to another user', async () => {
      const { service, mockPrisma } = createService();
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markRead('user-1', 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('is idempotent — skips update when readAt is already set', async () => {
      const { service, mockPrisma } = createService();
      mockPrisma.notification.findFirst.mockResolvedValue(
        makeNotification({ readAt: new Date('2024-01-15T09:00:00.000Z') }),
      );

      const result = await service.markRead('user-1', 'notif-1');

      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
      expect(result.readAt).not.toBeNull();
    });
  });

  describe('markAllRead', () => {
    it('returns the count of updated notifications from prisma updateMany', async () => {
      const { service, mockPrisma } = createService();
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead('user-1');

      expect(result.count).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) as Date },
      });
    });
  });
});
