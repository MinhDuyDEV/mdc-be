import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Industry } from "@prisma/client";
import { PrismaService } from "../infra/prisma/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import { CompaniesService } from "./companies.service";
import type { CreateCompanyDto } from "./dto/create-company.dto";

describe("CompaniesService", () => {
	let service: CompaniesService;
	let mockPrismaValue: any;
	let mockOutboxService: any;

	beforeEach(async () => {
		mockPrismaValue = {
			company: {
				findUnique: jest.fn(),
				findMany: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				count: jest.fn(),
			},
			companyMember: {
				findUnique: jest.fn(),
				findMany: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				delete: jest.fn(),
				deleteMany: jest.fn(),
			},
			companyFollower: {
				findUnique: jest.fn(),
				create: jest.fn(),
				delete: jest.fn(),
			},
			companyVerification: {
				create: jest.fn(),
				findMany: jest.fn(),
				update: jest.fn(),
			},
			companyEntitlement: {
				findMany: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
			},
			recruiterSeat: {
				findMany: jest.fn(),
				findFirst: jest.fn(),
				findUnique: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
			},
			memberInvitation: {
				findUnique: jest.fn(),
				findMany: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
			},
			user: {
				findUnique: jest.fn(),
			},
			$transaction: jest.fn((fn: any) => fn(mockPrismaValue)),
			$queryRaw: jest.fn(),
		};

		mockOutboxService = {
			emit: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CompaniesService,
				{ provide: PrismaService, useValue: mockPrismaValue },
				{ provide: OutboxService, useValue: mockOutboxService },
			],
		}).compile();

		service = module.get<CompaniesService>(CompaniesService);
	});

	describe("createCompany", () => {
		it("should create company with auto-generated slug", async () => {
			const userId = "user-123";
			const createDto: CreateCompanyDto = {
				name: "Acme Corp",
				industry: Industry.TECHNOLOGY,
				description: "A tech company",
			};

			const createdCompany = {
				id: "company-123",
				name: "Acme Corp",
				slug: "acme-corp",
				industry: "TECHNOLOGY",
				description: "A tech company",
				verified: false,
				followerCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPrismaValue.company.count.mockResolvedValue(0);
			mockPrismaValue.company.create.mockResolvedValue(createdCompany);

			const result = await service.createCompany(userId, createDto);

			expect(mockPrismaValue.company.count).toHaveBeenCalledWith({
				where: { slug: "acme-corp" },
			});
			expect(mockPrismaValue.company.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					name: "Acme Corp",
					slug: "acme-corp",
					industry: "TECHNOLOGY",
				}),
			});
			expect(mockPrismaValue.companyMember.create).toHaveBeenCalledWith({
				data: {
					companyId: "company-123",
					userId: "user-123",
					role: "admin",
					status: "active",
				},
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "CompanyCreated",
					aggregateType: "Company",
					aggregateId: "company-123",
				}),
			);
			expect(result).toEqual(createdCompany);
		});

		it("should handle slug collision with numeric suffix", async () => {
			const userId = "user-123";
			const createDto: CreateCompanyDto = { name: "Acme Corp" };

			mockPrismaValue.company.count
				.mockResolvedValueOnce(1) // acme-corp exists
				.mockResolvedValueOnce(0); // acme-corp-2 available

			mockPrismaValue.company.create.mockResolvedValue({
				id: "company-123",
				slug: "acme-corp-2",
			});

			await service.createCompany(userId, createDto);

			expect(mockPrismaValue.company.count).toHaveBeenCalledTimes(2);
			expect(mockPrismaValue.company.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ slug: "acme-corp-2" }),
			});
		});
	});

	describe("getCompanyBySlug", () => {
		it("should return company with members and follower count", async () => {
			const company = {
				id: "company-123",
				slug: "acme-corp",
				name: "Acme Corp",
				members: [{ userId: "user-1", role: "admin" }],
				followerCount: 42,
			};

			mockPrismaValue.company.findUnique.mockResolvedValue(company);

			const result = await service.getCompanyBySlug("acme-corp");

			expect(mockPrismaValue.company.findUnique).toHaveBeenCalledWith({
				where: { slug: "acme-corp" },
				include: expect.objectContaining({
					members: expect.objectContaining({
						include: expect.objectContaining({
							user: expect.objectContaining({
								select: expect.objectContaining({
									id: true,
									displayName: true,
									email: true,
								}),
							}),
						}),
					}),
					logoMediaAsset: true,
					coverMediaAsset: true,
				}),
			});
			expect(result).toEqual(company);
		});
	});

	describe("followCompany", () => {
		it("should create follower relationship and increment count", async () => {
			const userId = "user-123";
			const companyId = "company-123";

			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: companyId,
				followerCount: 10,
			});
			mockPrismaValue.companyFollower.findUnique.mockResolvedValue(null);
			mockPrismaValue.companyFollower.create.mockResolvedValue({
				id: "follower-123",
				companyId,
				userId,
			});

			await service.followCompany(userId, companyId);

			expect(mockPrismaValue.companyFollower.create).toHaveBeenCalledWith({
				data: { companyId, userId },
			});
			expect(mockPrismaValue.company.update).toHaveBeenCalledWith({
				where: { id: companyId },
				data: { followerCount: { increment: 1 } },
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "CompanyFollowed",
				}),
			);
		});

		it("should throw ConflictException if already following", async () => {
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: "company-123",
			});
			mockPrismaValue.companyFollower.findUnique.mockResolvedValue({
				id: "existing",
			});

			await expect(
				service.followCompany("user-123", "company-123"),
			).rejects.toThrow(ConflictException);
		});
	});

	describe("updateCompany", () => {
		it("should update company fields and emit event", async () => {
			const userId = "user-123";
			const companyId = "company-123";
			const updateDto = {
				name: "New Name",
				description: "Updated description",
			};

			// Member check: user is an admin
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId,
				companyId,
				role: "admin",
				status: "active",
			});

			// Company lookup
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: companyId,
				name: "Old Name",
				slug: "old-name",
			});

			// Slug check: new slug doesn't collide
			mockPrismaValue.company.count.mockResolvedValue(0);

			// Update result
			const updated = {
				id: companyId,
				name: "New Name",
				slug: "new-name",
				description: "Updated description",
			};
			mockPrismaValue.company.update.mockResolvedValue(updated);

			const result = await service.updateCompany(
				userId,
				companyId,
				updateDto as any,
			);

			expect(mockPrismaValue.company.update).toHaveBeenCalledWith({
				where: { id: companyId },
				data: expect.objectContaining({
					name: "New Name",
					slug: "new-name",
					description: "Updated description",
				}),
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "CompanyUpdated",
					aggregateType: "Company",
					aggregateId: companyId,
				}),
			);
			expect(result).toEqual(updated);
		});

		it("should throw NotFoundException if company not found", async () => {
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId: "user-123",
				companyId: "company-123",
				role: "admin",
				status: "active",
			});
			mockPrismaValue.company.findUnique.mockResolvedValue(null);

			await expect(
				service.updateCompany("user-123", "company-123", {} as any),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw ForbiddenException if user is not admin/owner", async () => {
			// Company exists
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: "company-123",
				name: "Test Co",
				slug: "test-co",
			});
			// User is member but not admin/owner
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId: "user-123",
				companyId: "company-123",
				role: "member",
				status: "active",
			});

			await expect(
				service.updateCompany("user-123", "company-123", {} as any),
			).rejects.toThrow(ForbiddenException);
		});

		it("should throw ForbiddenException if user is not a member", async () => {
			// Company exists
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: "company-123",
				name: "Test Co",
				slug: "test-co",
			});
			mockPrismaValue.companyMember.findUnique.mockResolvedValue(null);

			await expect(
				service.updateCompany("user-123", "company-123", {} as any),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("inviteMember", () => {
		it("should create invitation and emit event", async () => {
			const userId = "user-123";
			const companyId = "company-123";
			const dto = { email: "invite@test.com", role: "member" };

			// Company exists
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: companyId,
				name: "Test Co",
			});
			// Member is admin
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId,
				companyId,
				role: "admin",
				status: "active",
			});

			const invitation = {
				id: "invite-1",
				companyId,
				email: "invite@test.com",
				role: "member",
				token: "mock-token",
				status: "pending",
			};
			mockPrismaValue.memberInvitation.create.mockResolvedValue(invitation);

			const result = await service.inviteMember(userId, companyId, dto as any);

			expect(mockPrismaValue.memberInvitation.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					companyId,
					email: "invite@test.com",
					role: "member",
					invitedBy: userId,
					status: "pending",
				}),
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "MemberInvited",
					aggregateType: "Company",
					aggregateId: companyId,
				}),
			);
			expect(result).toEqual(invitation);
		});

		it("should throw ForbiddenException if not admin/owner", async () => {
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: "company-123",
			});
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId: "user-123",
				companyId: "company-123",
				role: "member",
				status: "active",
			});

			await expect(
				service.inviteMember("user-123", "company-123", {
					email: "x@x.com",
					role: "member",
				} as any),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("acceptInvitation", () => {
		it("should accept invitation and create membership", async () => {
			const userId = "user-123";
			const token = "valid-token";
			const companyId = "company-123";
			const futureDate = new Date(Date.now() + 86400000);

			// Find invitation
			mockPrismaValue.memberInvitation.findUnique.mockResolvedValue({
				id: "invite-1",
				companyId,
				email: "user@test.com",
				role: "member",
				token,
				status: "pending",
				expiresAt: futureDate,
			});

			const member = {
				id: "member-new",
				companyId,
				userId,
				role: "member",
				status: "active",
			};
			mockPrismaValue.companyMember.create.mockResolvedValue(member);

			const result = await service.acceptInvitation(userId, token);

			expect(mockPrismaValue.companyMember.create).toHaveBeenCalledWith({
				data: {
					companyId,
					userId,
					role: "member",
					status: "active",
				},
			});
			expect(mockPrismaValue.memberInvitation.update).toHaveBeenCalledWith({
				where: { id: "invite-1" },
				data: {
					status: "accepted",
					acceptedAt: expect.any(Date),
				},
			});
			expect(result).toEqual(member);
		});

		it("should throw NotFoundException for invalid token", async () => {
			mockPrismaValue.memberInvitation.findUnique.mockResolvedValue(null);

			await expect(
				service.acceptInvitation("user-123", "bad-token"),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw BadRequestException for expired invitation", async () => {
			const pastDate = new Date(Date.now() - 86400000);
			mockPrismaValue.memberInvitation.findUnique.mockResolvedValue({
				id: "invite-1",
				companyId: "company-123",
				token: "expired-token",
				status: "pending",
				expiresAt: pastDate,
			});

			await expect(
				service.acceptInvitation("user-123", "expired-token"),
			).rejects.toThrow(BadRequestException);
		});

		it("should throw BadRequestException for already accepted invitation", async () => {
			mockPrismaValue.memberInvitation.findUnique.mockResolvedValue({
				id: "invite-1",
				companyId: "company-123",
				token: "used-token",
				status: "accepted",
				expiresAt: new Date(Date.now() + 86400000),
			});

			await expect(
				service.acceptInvitation("user-123", "used-token"),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("allocateRecruiterSeat", () => {
		it("should allocate an available seat to target user", async () => {
			const userId = "admin-123";
			const companyId = "company-123";
			const targetUserId = "target-456";

			// Company exists
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: companyId,
				name: "Test Co",
			});
			// Member is admin
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId,
				companyId,
				role: "admin",
				status: "active",
			});
			// Target user exists
			mockPrismaValue.user.findUnique.mockResolvedValue({
				id: targetUserId,
				email: "target@test.com",
			});
			// Available seat
			mockPrismaValue.recruiterSeat.findFirst.mockResolvedValue({
				id: "seat-1",
				companyId,
				userId: null,
				status: "available",
			});

			const allocatedSeat = {
				id: "seat-1",
				companyId,
				userId: targetUserId,
				status: "allocated",
				allocatedAt: new Date(),
			};
			mockPrismaValue.recruiterSeat.update.mockResolvedValue(allocatedSeat);

			const result = await service.allocateRecruiterSeat(
				userId,
				companyId,
				targetUserId,
			);

			expect(mockPrismaValue.recruiterSeat.update).toHaveBeenCalledWith({
				where: { id: "seat-1" },
				data: {
					userId: targetUserId,
					status: "allocated",
					allocatedAt: expect.any(Date),
				},
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "RecruiterSeatAllocated",
				}),
			);
			expect(result).toEqual(allocatedSeat);
		});

		it("should throw BadRequestException if no available seats", async () => {
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: "company-123",
			});
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId: "admin-123",
				companyId: "company-123",
				role: "admin",
				status: "active",
			});
			mockPrismaValue.user.findUnique.mockResolvedValue({
				id: "target-456",
			});
			mockPrismaValue.recruiterSeat.findFirst.mockResolvedValue(null);

			await expect(
				service.allocateRecruiterSeat("admin-123", "company-123", "target-456"),
			).rejects.toThrow(BadRequestException);
		});

		it("should throw ForbiddenException if not admin/owner", async () => {
			mockPrismaValue.company.findUnique.mockResolvedValue({
				id: "company-123",
			});
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId: "admin-123",
				companyId: "company-123",
				role: "member",
				status: "active",
			});

			await expect(
				service.allocateRecruiterSeat("admin-123", "company-123", "target-456"),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("deallocateRecruiterSeat", () => {
		it("should deallocate seat and make it available", async () => {
			const userId = "admin-123";
			const companyId = "company-123";
			const seatId = "seat-1";

			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId,
				companyId,
				role: "admin",
				status: "active",
			});
			mockPrismaValue.recruiterSeat.findUnique.mockResolvedValue({
				id: seatId,
				companyId,
				userId: "target-456",
				status: "allocated",
			});

			const deallocated = {
				id: seatId,
				companyId,
				userId: null,
				status: "available",
				allocatedAt: null,
			};
			mockPrismaValue.recruiterSeat.update.mockResolvedValue(deallocated);

			await service.deallocateRecruiterSeat(userId, companyId, seatId);

			expect(mockPrismaValue.recruiterSeat.update).toHaveBeenCalledWith({
				where: { id: seatId },
				data: {
					userId: null,
					status: "available",
					allocatedAt: null,
				},
			});
			expect(mockOutboxService.emit).toHaveBeenCalledWith(
				mockPrismaValue,
				expect.objectContaining({
					eventType: "RecruiterSeatDeallocated",
				}),
			);
		});

		it("should throw BadRequestException if seat not allocated", async () => {
			mockPrismaValue.companyMember.findUnique.mockResolvedValue({
				id: "member-1",
				userId: "admin-123",
				companyId: "company-123",
				role: "admin",
				status: "active",
			});
			mockPrismaValue.recruiterSeat.findUnique.mockResolvedValue({
				id: "seat-1",
				companyId: "company-123",
				userId: null,
				status: "available",
			});

			await expect(
				service.deallocateRecruiterSeat("admin-123", "company-123", "seat-1"),
			).rejects.toThrow(BadRequestException);
		});
	});
});
