import { ConflictException } from "@nestjs/common";
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
				create: jest.fn(),
				update: jest.fn(),
			},
			memberInvitation: {
				findUnique: jest.fn(),
				findMany: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
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
});
