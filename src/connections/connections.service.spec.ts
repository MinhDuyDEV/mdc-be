import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ConnectionStatus, FollowStatus } from "@prisma/client";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { IdempotencyService } from "../outbox/idempotency.service";
import { ConnectionsService } from "./connections.service";
import type { ConnectionsPolicyService } from "./connections-policy.service";

interface MockPrisma {
  connection: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  follow: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  block: {
    findFirst: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    connection: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    follow: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    block: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: MockPrisma) => Promise<unknown>) =>
    cb(prisma),
  );
  return prisma;
}

interface MockPolicy {
  isBlocked: jest.Mock;
  areConnected: jest.Mock;
  isFollowing: jest.Mock;
}

describe("ConnectionsService", () => {
  let prisma: MockPrisma;
  let outbox: { emit: jest.Mock };
  let idempotency: { claim: jest.Mock };
  let connectionsPolicy: MockPolicy;
  let service: ConnectionsService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    outbox = { emit: jest.fn().mockResolvedValue(undefined) };
    idempotency = { claim: jest.fn().mockResolvedValue({}) };
    connectionsPolicy = {
      isBlocked: jest.fn().mockResolvedValue(false),
      areConnected: jest.fn().mockResolvedValue(false),
      isFollowing: jest.fn().mockResolvedValue(false),
    };
    service = new ConnectionsService(
      prisma as unknown as PrismaService,
      outbox,
      idempotency as unknown as IdempotencyService,
      connectionsPolicy as unknown as ConnectionsPolicyService,
    );
  });

  describe("sendRequest", () => {
    it("rejects self-connection with CANNOT_CONNECT_TO_SELF", async () => {
      await expect(service.sendRequest("user-1", { toUserId: "user-1" })).rejects.toThrow(
        new BadRequestException("CANNOT_CONNECT_TO_SELF"),
      );
    });

    it("rejects when blocked with BLOCKED_USER", async () => {
      connectionsPolicy.isBlocked.mockResolvedValue(true);
      await expect(service.sendRequest("user-1", { toUserId: "user-2" })).rejects.toThrow(
        new BadRequestException("BLOCKED_USER"),
      );
    });

    it("rejects duplicate connection with CONNECTION_ALREADY_EXISTS", async () => {
      prisma.connection.findFirst.mockResolvedValue({
        id: "conn-1",
        status: ConnectionStatus.PENDING,
      });
      await expect(service.sendRequest("user-1", { toUserId: "user-2" })).rejects.toThrow(
        new ConflictException("CONNECTION_ALREADY_EXISTS"),
      );
    });

    it("creates connection and emits ConnectionRequested event", async () => {
      prisma.connection.findFirst.mockResolvedValue(null);
      prisma.connection.create.mockResolvedValue({
        id: "conn-1",
        requesterId: "user-1",
        addresseeId: "user-2",
        status: ConnectionStatus.PENDING,
        requester: null,
        addressee: null,
      });

      await service.sendRequest("user-1", { toUserId: "user-2" });

      expect(prisma.connection.create).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: "ConnectionRequested" }),
      );
    });
  });

  describe("acceptRequest", () => {
    it("rejects when connection not found or not addressee", async () => {
      prisma.connection.findUnique.mockResolvedValue(null);
      await expect(service.acceptRequest("user-2", "conn-1")).rejects.toThrow(
        new NotFoundException("CONNECTION_NOT_FOUND"),
      );
    });

    it("rejects when connection not PENDING", async () => {
      prisma.connection.findUnique.mockResolvedValue({
        id: "conn-1",
        addresseeId: "user-2",
        status: ConnectionStatus.ACCEPTED,
      });
      await expect(service.acceptRequest("user-2", "conn-1")).rejects.toThrow(
        new BadRequestException("CONNECTION_NOT_PENDING"),
      );
    });

    it("updates status to ACCEPTED and emits ConnectionAccepted event", async () => {
      prisma.connection.findUnique.mockResolvedValue({
        id: "conn-1",
        requesterId: "user-1",
        addresseeId: "user-2",
        status: ConnectionStatus.PENDING,
      });
      prisma.connection.update.mockResolvedValue({
        id: "conn-1",
        status: ConnectionStatus.ACCEPTED,
        requester: null,
        addressee: null,
      });

      await service.acceptRequest("user-2", "conn-1");

      expect(prisma.connection.update).toHaveBeenCalledWith({
        where: { id: "conn-1" },
        data: { status: ConnectionStatus.ACCEPTED },
        include: expect.any(Object),
      });
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: "ConnectionAccepted" }),
      );
    });
  });

  describe("blockUser", () => {
    it("rejects self-block with CANNOT_BLOCK_SELF", async () => {
      await expect(service.blockUser("user-1", "user-1")).rejects.toThrow(
        new BadRequestException("CANNOT_BLOCK_SELF"),
      );
    });

    it("rejects duplicate block with BLOCK_ALREADY_EXISTS", async () => {
      prisma.block.findFirst.mockResolvedValue({ id: "block-1" });
      await expect(service.blockUser("user-1", "user-2")).rejects.toThrow(
        new ConflictException("BLOCK_ALREADY_EXISTS"),
      );
    });

    it("creates block, removes connections, deactivates follows, emits UserBlocked", async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.block.create.mockResolvedValue({
        id: "block-1",
        blockerId: "user-1",
        blockedId: "user-2",
      });

      await service.blockUser("user-1", "user-2");

      expect(prisma.block.create).toHaveBeenCalled();
      expect(prisma.connection.updateMany).toHaveBeenCalled();
      expect(prisma.follow.updateMany).toHaveBeenCalled();
      expect(outbox.emit).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ eventType: "UserBlocked" }),
      );
    });
  });

  describe("follow", () => {
    it("rejects self-follow with CANNOT_FOLLOW_SELF", async () => {
      await expect(service.follow("user-1", "user-1")).rejects.toThrow(
        new BadRequestException("CANNOT_FOLLOW_SELF"),
      );
    });

    it("rejects when blocked with BLOCKED_USER", async () => {
      connectionsPolicy.isBlocked.mockResolvedValue(true);
      await expect(service.follow("user-1", "user-2")).rejects.toThrow(
        new BadRequestException("BLOCKED_USER"),
      );
    });

    it("is idempotent — returns existing ACTIVE follow", async () => {
      const existing = {
        id: "follow-1",
        followerId: "user-1",
        followeeId: "user-2",
        status: FollowStatus.ACTIVE,
      };
      prisma.follow.findFirst.mockResolvedValue(existing);

      const result = await service.follow("user-1", "user-2");

      expect(result).toBe(existing);
      expect(prisma.follow.create).not.toHaveBeenCalled();
    });

    it("creates new follow when none exists", async () => {
      prisma.follow.findFirst.mockResolvedValue(null);
      prisma.follow.create.mockResolvedValue({
        id: "follow-1",
        followerId: "user-1",
        followeeId: "user-2",
        status: FollowStatus.ACTIVE,
      });

      await service.follow("user-1", "user-2");

      expect(prisma.follow.create).toHaveBeenCalledWith({
        data: {
          followerId: "user-1",
          followeeId: "user-2",
          status: FollowStatus.ACTIVE,
        },
      });
    });
  });

  describe("getMutualConnections", () => {
    const mutualUser = {
      id: "user-mutual",
      email: "mutual@test.com",
      firstName: "M",
      lastName: "U",
      headline: "Developer",
      connectedAt: new Date("2025-01-15"),
    };

    it("returns mutual connections between two users", async () => {
      prisma.$queryRaw.mockResolvedValue([mutualUser]);

      const result = await service.getMutualConnections("user-1", "user-2", {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mutualUser);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.nextCursor).toBeUndefined();
      expect(result.meta.limit).toBe(20);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when there are no mutual connections", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getMutualConnections("user-1", "user-2", {});

      expect(result.data).toEqual([]);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.nextCursor).toBeUndefined();
    });

    it("handles cursor pagination correctly", async () => {
      const cursorDate = new Date("2025-01-01");
      const cursor = Buffer.from(
        JSON.stringify({
          createdAt: cursorDate.toISOString(),
          id: "last-item",
        }),
      ).toString("base64");

      const rows = Array.from({ length: 25 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@test.com`,
        firstName: "First",
        lastName: `Last${i}`,
        headline: `Headline ${i}`,
        connectedAt: new Date(2025, 0, 30 - i),
      }));

      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.getMutualConnections("user-1", "user-2", {
        cursor,
        limit: 20,
      });

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
      expect(result.meta.limit).toBe(20);
    });
  });

  describe("getMutualConnectionCount", () => {
    it("returns the count of mutual connections", async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: 3n }]);

      const result = await service.getMutualConnectionCount("user-1", "user-2");

      expect(result).toBe(3);
    });

    it("returns 0 when no mutual connections exist", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getMutualConnectionCount("user-1", "user-2");

      expect(result).toBe(0);
    });
  });
});
