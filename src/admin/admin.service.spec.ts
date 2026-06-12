import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { AdminService } from "./admin.service";

describe("AdminService", () => {
  let service: AdminService;
  let prisma: any;
  let deadLetter: any;
  let outbox: any;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      company: { findMany: jest.fn(), update: jest.fn() },
      companyVerification: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      job: { findMany: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn(), findMany: jest.fn() },
      adminUser: {
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      adminPermission: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      refreshToken: { updateMany: jest.fn() },
      outboxDeadLetter: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    deadLetter = { replay: jest.fn() };
    outbox = { emit: jest.fn() };
    service = new AdminService(prisma, deadLetter, outbox);
  });

  describe("listUsers", () => {
    it("returns paginated users", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1", email: "test@example.com" }]);
      const result = await service.listUsers({});
      expect(result.data).toHaveLength(1);
    });
  });

  describe("updateUserStatus", () => {
    it("suspends user and revokes sessions", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        status: UserStatus.ACTIVE,
      });
      prisma.user.update.mockResolvedValue({
        id: "user-1",
        status: UserStatus.SUSPENDED,
      });
      await service.updateUserStatus(
        "user-1",
        { status: UserStatus.SUSPENDED, reason: "Spam" },
        "admin-1",
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("throws BadRequestException for invalid transition DELETED → ACTIVE", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        status: UserStatus.DELETED,
      });
      await expect(
        service.updateUserStatus(
          "user-1",
          { status: UserStatus.ACTIVE, reason: "Restore" },
          "admin-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(outbox.emit).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUserStatus(
          "missing",
          { status: UserStatus.SUSPENDED, reason: "x" },
          "admin-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("short-circuits on no-op (same status) and emits no event", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        status: UserStatus.ACTIVE,
      });
      await service.updateUserStatus(
        "user-1",
        { status: UserStatus.ACTIVE, reason: "re-click" },
        "admin-1",
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(outbox.emit).not.toHaveBeenCalled();
    });

    it("emits UserStatusChanged with previousStatus", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        status: UserStatus.ACTIVE,
      });
      await service.updateUserStatus(
        "user-1",
        { status: UserStatus.SUSPENDED, reason: "Spam" },
        "admin-1",
      );
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          eventType: "UserStatusChanged",
          payload: expect.objectContaining({
            userId: "user-1",
            previousStatus: UserStatus.ACTIVE,
            newStatus: UserStatus.SUSPENDED,
            changedBy: "admin-1",
          }),
        }),
      );
    });

    it("captures previousStatus in audit log metadata", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        status: UserStatus.ACTIVE,
      });
      await service.updateUserStatus(
        "user-1",
        { status: UserStatus.SUSPENDED, reason: "Spam" },
        "admin-1",
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            previousStatus: UserStatus.ACTIVE,
            newStatus: UserStatus.SUSPENDED,
          }),
        }),
      });
    });
  });

  describe("dead letters", () => {
    it("lists dead letters with pagination metadata", async () => {
      prisma.outboxDeadLetter.findMany.mockResolvedValue([
        { id: "dl-1", eventType: "UserRegistered" },
      ]);

      const result = await service.listDeadLetters({
        eventType: "UserRegistered",
      });

      expect(prisma.outboxDeadLetter.findMany).toHaveBeenCalledWith({
        where: { eventType: "UserRegistered" },
        take: 51,
        orderBy: { failedAt: "desc" },
      });
      expect(result).toEqual({
        data: [{ id: "dl-1", eventType: "UserRegistered" }],
        meta: { hasNextPage: false, endCursor: "dl-1" },
      });
    });

    it("replays dead letter and writes audit log in the same transaction", async () => {
      await service.replayDeadLetter("dl-1", "admin-1");

      expect(deadLetter.replay).toHaveBeenCalledWith(prisma, "dl-1");
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: "admin-1",
          action: "admin.outbox.dead_letter.replay",
          entityType: "OutboxDeadLetter",
          entityId: "dl-1",
          metadata: {},
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // W1-T3: Audit Log Viewer
  // ---------------------------------------------------------------------------

  describe("listAuditLogs", () => {
    it("returns paginated results with actor data", async () => {
      const rows = [
        {
          id: "log-1",
          createdAt: new Date("2026-01-02"),
          actorUserId: "actor-1",
          action: "admin.user.status_change",
          entityType: "User",
          entityId: "user-1",
          metadata: {},
          actor: {
            id: "actor-1",
            email: "admin@test.com",
            displayName: "Admin",
            profile: { id: "profile-1", headline: "Head Admin" },
          },
        },
      ];
      prisma.auditLog.findMany.mockResolvedValue(rows);

      const result = await service.listAuditLogs({ limit: 50 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            actor: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                email: true,
                displayName: true,
              }),
            }),
          }),
          take: 51,
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: "log-1" });
      expect(result.meta).toMatchObject({ hasNextPage: false, limit: 50 });
    });

    it("applies date range and entity filters", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs({
        actorUserId: "actor-1",
        entityType: "User",
        entityId: "user-1",
        action: "admin.user.status_change",
        dateFrom: "2026-01-01T00:00:00Z",
        dateTo: "2026-12-31T23:59:59Z",
        limit: 50,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actorUserId: "actor-1",
            entityType: "User",
            entityId: "user-1",
            action: "admin.user.status_change",
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // W1-T4: Admin User Management
  // ---------------------------------------------------------------------------

  describe("createAdmin", () => {
    it("creates admin user with permissions and writes audit log", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@test.com",
      });
      prisma.adminUser.findUnique.mockResolvedValue(null);
      prisma.adminUser.create.mockResolvedValue({
        id: "admin-1",
        userId: "user-1",
        role: "ADMIN",
        user: { id: "user-1", email: "user@test.com", displayName: "User" },
        permissions: [{ id: "p1", adminUserId: "admin-1", permission: "MANAGE_USERS" }],
      });

      const result = await service.createAdmin("acting-admin-1", {
        userId: "user-1",
        permissions: ["MANAGE_USERS"],
      });

      expect(prisma.adminUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            role: "ADMIN",
            permissions: {
              create: [{ permission: "MANAGE_USERS" }],
            },
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: "acting-admin-1",
          action: "admin.management.create",
          entityType: "AdminUser",
          metadata: expect.objectContaining({
            targetUserId: "user-1",
            permissions: ["MANAGE_USERS"],
          }),
        }),
      });
      expect(result).toMatchObject({ id: "admin-1" });
    });

    it("throws ConflictException when user is already an admin", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.adminUser.findUnique.mockResolvedValue({
        id: "admin-1",
        userId: "user-1",
      });

      await expect(
        service.createAdmin("admin-1", {
          userId: "user-1",
          permissions: ["MANAGE_USERS"],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("throws NotFoundException when target user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createAdmin("admin-1", {
          userId: "missing",
          permissions: ["MANAGE_USERS"],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("removeAdmin", () => {
    it("deletes admin and writes audit log", async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: "target-1",
        userId: "user-1",
      });

      await service.removeAdmin("acting-admin", "target-1");

      expect(prisma.adminUser.delete).toHaveBeenCalledWith({
        where: { id: "target-1" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: "acting-admin",
          action: "admin.management.remove",
          entityType: "AdminUser",
          entityId: "target-1",
          metadata: { targetUserId: "user-1" },
        }),
      });
    });

    it("throws NotFoundException when admin does not exist", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(service.removeAdmin("acting-admin", "missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateAdminPermissions", () => {
    it("replaces permissions atomically and writes audit log", async () => {
      const existingPerms = [{ id: "old-1", adminUserId: "target-1", permission: "MANAGE_JOBS" }];

      prisma.adminUser.findUnique
        .mockResolvedValueOnce({
          id: "target-1",
          userId: "user-1",
          permissions: existingPerms,
        })
        .mockResolvedValueOnce({
          id: "target-1",
          userId: "user-1",
          user: { id: "user-1", email: "user@test.com", displayName: "User" },
          permissions: [
            {
              id: "new-1",
              adminUserId: "target-1",
              permission: "MANAGE_USERS",
            },
          ],
        });

      const result = await service.updateAdminPermissions("acting-admin", "target-1", {
        permissions: ["MANAGE_USERS"],
      });

      expect(prisma.adminPermission.deleteMany).toHaveBeenCalledWith({
        where: { adminUserId: "target-1" },
      });
      expect(prisma.adminPermission.createMany).toHaveBeenCalledWith({
        data: [{ adminUserId: "target-1", permission: "MANAGE_USERS" }],
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: "acting-admin",
          action: "admin.management.update_permissions",
          entityType: "AdminUser",
          entityId: "target-1",
          metadata: expect.objectContaining({
            targetUserId: "user-1",
            oldPermissions: ["MANAGE_JOBS"],
            newPermissions: ["MANAGE_USERS"],
          }),
        }),
      });
      expect(result).toMatchObject({ id: "target-1" });
    });

    it("throws NotFoundException when admin does not exist", async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAdminPermissions("acting-admin", "missing", {
          permissions: ["MANAGE_USERS"],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("listAdmins", () => {
    it("returns all admins with user data and permissions", async () => {
      const mockAdmins = [
        {
          id: "admin-1",
          userId: "user-1",
          role: "ADMIN",
          createdAt: new Date(),
          user: {
            id: "user-1",
            email: "admin@test.com",
            displayName: "Admin",
            status: "ACTIVE",
          },
          permissions: [{ permission: "MANAGE_USERS" }, { permission: "MANAGE_JOBS" }],
        },
      ];
      prisma.adminUser.findMany.mockResolvedValue(mockAdmins);

      const result = await service.listAdmins();

      expect(prisma.adminUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                status: true,
              },
            },
            permissions: {
              select: { permission: true },
            },
          }),
          orderBy: { createdAt: "desc" },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "admin-1",
        user: { email: "admin@test.com" },
      });
    });
  });
});
