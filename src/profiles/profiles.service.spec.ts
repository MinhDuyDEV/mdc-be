import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma, ProfileVisibility } from "@prisma/client";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ProfilesService } from "./profiles.service";

function createPrismaUniqueViolationError() {
	return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
		code: "P2002",
		clientVersion: Prisma.prismaVersion.client,
	});
}

describe("ProfilesService", () => {
	let service: ProfilesService;
	let prisma: PrismaService;

	let mockPrismaValue: any;

	beforeEach(async () => {
		mockPrismaValue = {
			profile: {
				findUnique: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
			},
			user: {
				findUnique: jest.fn(),
			},
			profileSkill: {
				deleteMany: jest.fn(),
				createMany: jest.fn(),
				findMany: jest.fn(),
			},
			experience: {
				deleteMany: jest.fn(),
				createMany: jest.fn(),
				findMany: jest.fn(),
			},
			education: {
				deleteMany: jest.fn(),
				createMany: jest.fn(),
				findMany: jest.fn(),
			},
			certification: {
				deleteMany: jest.fn(),
				createMany: jest.fn(),
				findMany: jest.fn(),
			},
			profileLanguage: {
				deleteMany: jest.fn(),
				createMany: jest.fn(),
				findMany: jest.fn(),
			},
			$transaction: jest.fn((fn: any) => fn(mockPrismaValue)),
			$queryRaw: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ProfilesService,
				{
					provide: PrismaService,
					useValue: mockPrismaValue,
				},
			],
		}).compile();

		service = module.get<ProfilesService>(ProfilesService);
		prisma = module.get<PrismaService>(PrismaService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("getOwnProfile", () => {
		it("should return existing profile with all includes", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const profile = {
				id: "prof-1",
				userId: "user-123",
				headline: "Engineer",
				about: "About me",
				location: "NY",
				website: "https://example.com",
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PUBLIC,
				createdAt: new Date(),
				updatedAt: new Date(),
				skills: [],
				experiences: [],
				educations: [],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(profile);

			const result = await service.getOwnProfile(user);
			expect(result).toEqual(profile);
			expect(prisma.profile.findUnique).toHaveBeenCalledWith(
				expect.objectContaining({ where: { userId: "user-123" } }),
			);
		});

		it("should auto-create profile shell when none exists", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const created = {
				id: "prof-new",
				userId: "user-123",
				headline: null,
				about: null,
				location: null,
				website: null,
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PUBLIC,
				createdAt: new Date(),
				updatedAt: new Date(),
				skills: [],
				experiences: [],
				educations: [],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValueOnce(null)
				.mockResolvedValue(created);
			jest.spyOn(prisma.profile, "create").mockResolvedValue(created);

			const result = await service.getOwnProfile(user);
			expect(result).toEqual(created);
			expect(prisma.profile.create).toHaveBeenCalledWith(
				expect.objectContaining({ data: { userId: "user-123" } }),
			);
		});
	});

	describe("updateOwnProfile", () => {
		it("should update an existing profile", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const existing = {
				id: "prof-1",
				userId: "user-123",
				headline: "Old",
				about: null,
				location: null,
				website: null,
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PUBLIC,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const updated = {
				...existing,
				headline: "New Headline",
			};
			const final = {
				...updated,
				skills: [],
				experiences: [],
				educations: [],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(existing);
			jest.spyOn(prisma.profile, "update").mockResolvedValue(updated);
			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(final);

			const result = await service.updateOwnProfile(user, {
				headline: "New Headline",
			});
			expect(result!.headline).toBe("New Headline");
			expect(prisma.profile.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: "user-123" },
					data: { headline: "New Headline" },
				}),
			);
		});

		it("should auto-create profile when updating non-existent one", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const created = {
				id: "prof-new",
				userId: "user-123",
				headline: "Headline",
				about: null,
				location: null,
				website: null,
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PUBLIC,
				createdAt: new Date(),
				updatedAt: new Date(),
				skills: [],
				experiences: [],
				educations: [],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValueOnce(null)
				.mockResolvedValue(created);
			jest.spyOn(prisma.profile, "create").mockResolvedValue(created);

			const result = await service.updateOwnProfile(user, {
				headline: "Headline",
			});
			expect(result!.headline).toBe("Headline");
			expect(prisma.profile.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { userId: "user-123", headline: "Headline" },
				}),
			);
		});

		it("should replace skills when provided", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const existing = {
				id: "prof-1",
				userId: "user-123",
				headline: "Engineer",
				about: null,
				location: null,
				website: null,
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PUBLIC,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(existing);
			jest.spyOn(prisma.profile, "update").mockResolvedValue(existing);
			jest
				.spyOn(prisma.profileSkill, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.profileSkill, "createMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.profileSkill, "findMany")
				.mockResolvedValue([{ id: "s1", name: "TypeScript" }] as any);

			await service.updateOwnProfile(user, {
				skills: [{ name: "TypeScript", proficiency: "ADVANCED" }],
			});

			expect(prisma.profileSkill.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.profileSkill.createMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: [
						{
							profileId: "prof-1",
							name: "TypeScript",
							proficiency: "ADVANCED",
						},
					],
				}),
			);
		});

		it("should replace experiences when provided", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const existing = {
				id: "prof-1",
				userId: "user-123",
				headline: "Engineer",
				about: null,
				location: null,
				website: null,
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PUBLIC,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(existing);
			jest.spyOn(prisma.profile, "update").mockResolvedValue(existing);
			jest
				.spyOn(prisma.experience, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.experience, "createMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.experience, "findMany")
				.mockResolvedValue([{ id: "e1", title: "Dev" }] as any);

			await service.updateOwnProfile(user, {
				experiences: [
					{
						title: "Dev",
						company: "Acme",
						startDate: "2020-01-01",
						endDate: "2023-01-01",
					},
				],
			});

			expect(prisma.experience.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.experience.createMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: [
						expect.objectContaining({
							title: "Dev",
							company: "Acme",
							startDate: expect.any(Date),
							endDate: expect.any(Date),
							isCurrent: false,
						}),
					],
				}),
			);
		});
	});

	describe("getPublicProfile", () => {
		it("should return full profile for PUBLIC visibility", async () => {
			const profile = {
				id: "prof-1",
				userId: "user-123",
				headline: "Engineer",
				about: "About",
				location: "NY",
				website: "https://example.com",
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PUBLIC,
				createdAt: new Date(),
				updatedAt: new Date(),
				skills: [{ id: "s1", name: "TS" }],
				experiences: [{ id: "e1", title: "Dev" }],
				educations: [{ id: "ed1", school: "MIT" }],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
				id: "user-123",
				status: "ACTIVE",
			} as any);
			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(profile);

			const result = await service.getPublicProfile("user-123");
			expect(result).toEqual(
				expect.objectContaining({
					id: "prof-1",
					headline: "Engineer",
					about: "About",
					location: "NY",
					skills: [{ id: "s1", name: "TS" }],
					experiences: [{ id: "e1", title: "Dev" }],
					educations: [{ id: "ed1", school: "MIT" }],
				}),
			);
		});

		it("should return limited profile for CONNECTIONS_ONLY visibility", async () => {
			const profile = {
				id: "prof-1",
				userId: "user-123",
				headline: "Engineer",
				about: "About",
				location: "NY",
				website: "https://example.com",
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.CONNECTIONS_ONLY,
				createdAt: new Date(),
				updatedAt: new Date(),
				skills: [{ id: "s1", name: "TS" }],
				experiences: [{ id: "e1", title: "Dev" }],
				educations: [{ id: "ed1", school: "MIT" }],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
				id: "user-123",
				status: "ACTIVE",
			} as any);
			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(profile);

			const result = await service.getPublicProfile("user-123");
			expect(result).toEqual(
				expect.objectContaining({
					id: "prof-1",
					headline: "Engineer",
					location: "NY",
					skills: [{ id: "s1", name: "TS" }],
				}),
			);
			expect(result).not.toHaveProperty("about");
			expect(result).not.toHaveProperty("experiences");
			expect(result).not.toHaveProperty("educations");
			expect(result).not.toHaveProperty("certifications");
			expect(result).not.toHaveProperty("languages");
			expect(result).not.toHaveProperty("endorsements");
		});

		it("should return minimal profile for PRIVATE visibility", async () => {
			const profile = {
				id: "prof-1",
				userId: "user-123",
				headline: "Engineer",
				about: "About",
				location: "NY",
				website: "https://example.com",
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PRIVATE,
				createdAt: new Date(),
				updatedAt: new Date(),
				skills: [],
				experiences: [],
				educations: [],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
				id: "user-123",
				status: "ACTIVE",
			} as any);
			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(profile);

			const result = await service.getPublicProfile("user-123");
			expect(result).toEqual(
				expect.objectContaining({
					id: "prof-1",
					headline: "Engineer",
				}),
			);
			expect(result).not.toHaveProperty("about");
			expect(result).not.toHaveProperty("location");
			expect(result).not.toHaveProperty("skills");
		});

		it("should return full profile when owner views own profile", async () => {
			const profile = {
				id: "prof-1",
				userId: "user-123",
				headline: "Engineer",
				about: "About",
				location: "NY",
				website: "https://example.com",
				openToWork: false,
				recruitingEligible: false,
				visibility: ProfileVisibility.PRIVATE,
				createdAt: new Date(),
				updatedAt: new Date(),
				skills: [{ id: "s1", name: "TS" }],
				experiences: [],
				educations: [],
				certifications: [],
				languages: [],
				endorsements: [],
			};

			jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
				id: "user-123",
				status: "ACTIVE",
			} as any);
			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(profile);

			const currentUser = { id: "user-123", email: "test@example.com" };
			const result = await service.getPublicProfile("user-123", currentUser);
			expect(result).toEqual(profile);
		});

		it("should throw NotFoundException for deleted user", async () => {
			jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
				id: "user-123",
				status: "DELETED",
			} as any);

			await expect(service.getPublicProfile("user-123")).rejects.toThrow(
				NotFoundException,
			);
		});

		it("should throw NotFoundException for disabled user", async () => {
			jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
				id: "user-123",
				status: "DISABLED",
			} as any);

			await expect(service.getPublicProfile("user-123")).rejects.toThrow(
				NotFoundException,
			);
		});

		it("should throw NotFoundException when profile does not exist", async () => {
			jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
				id: "user-123",
				status: "ACTIVE",
			} as any);
			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(null);

			await expect(service.getPublicProfile("user-123")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("replaceSkills", () => {
		it("should delete existing skills and create new ones", async () => {
			jest
				.spyOn(prisma.profileSkill, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.profileSkill, "createMany")
				.mockResolvedValue({ count: 2 });
			jest.spyOn(prisma.profileSkill, "findMany").mockResolvedValue([
				{ id: "s1", name: "TS" },
				{ id: "s2", name: "JS" },
			] as any);

			const result = await service.replaceSkills("prof-1", [
				{ name: "TypeScript", proficiency: "ADVANCED" },
				{ name: "JavaScript", proficiency: "INTERMEDIATE" },
			]);

			expect(prisma.profileSkill.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.profileSkill.createMany).toHaveBeenCalledWith({
				data: [
					{ profileId: "prof-1", name: "TypeScript", proficiency: "ADVANCED" },
					{
						profileId: "prof-1",
						name: "JavaScript",
						proficiency: "INTERMEDIATE",
					},
				],
				skipDuplicates: true,
			});
			expect(result).toHaveLength(2);
		});

		it("should throw ConflictException on duplicate skill P2002", async () => {
			jest
				.spyOn(prisma.profileSkill, "deleteMany")
				.mockResolvedValue({ count: 0 });
			jest
				.spyOn(prisma.profileSkill, "createMany")
				.mockRejectedValue(createPrismaUniqueViolationError());

			await expect(
				service.replaceSkills("prof-1", [{ name: "TypeScript" }]),
			).rejects.toThrow(ConflictException);
		});

		it("should skip createMany when skills array is empty", async () => {
			jest
				.spyOn(prisma.profileSkill, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.profileSkill, "createMany")
				.mockResolvedValue({ count: 0 });
			jest.spyOn(prisma.profileSkill, "findMany").mockResolvedValue([]);

			await service.replaceSkills("prof-1", []);

			expect(prisma.profileSkill.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.profileSkill.createMany).not.toHaveBeenCalled();
		});
	});

	describe("replaceExperiences", () => {
		it("should delete existing experiences and create new ones with date conversion", async () => {
			jest
				.spyOn(prisma.experience, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.experience, "createMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.experience, "findMany")
				.mockResolvedValue([{ id: "e1" }] as any);

			const result = await service.replaceExperiences("prof-1", [
				{
					title: "Dev",
					company: "Acme",
					startDate: "2020-01-01",
					endDate: "2023-01-01",
				},
			]);

			expect(prisma.experience.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.experience.createMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: [
						expect.objectContaining({
							startDate: expect.any(Date),
							endDate: expect.any(Date),
						}),
					],
				}),
			);
			expect(result).toHaveLength(1);
		});

		it("should throw BadRequestException when startDate >= endDate", async () => {
			await expect(
				service.replaceExperiences("prof-1", [
					{
						title: "Dev",
						company: "Acme",
						startDate: "2023-01-01",
						endDate: "2020-01-01",
					},
				]),
			).rejects.toThrow(BadRequestException);
		});

		it("should throw BadRequestException when isCurrent=true and endDate is set", async () => {
			await expect(
				service.replaceExperiences("prof-1", [
					{
						title: "Dev",
						company: "Acme",
						startDate: "2020-01-01",
						endDate: "2023-01-01",
						isCurrent: true,
					},
				]),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("replaceEducations", () => {
		it("should delete existing educations and create new ones with date conversion", async () => {
			jest
				.spyOn(prisma.education, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.education, "createMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.education, "findMany")
				.mockResolvedValue([{ id: "ed1" }] as any);

			const result = await service.replaceEducations("prof-1", [
				{
					school: "MIT",
					degree: "BS",
					startDate: "2015-09-01",
					endDate: "2019-06-01",
				},
			]);

			expect(prisma.education.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.education.createMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: [
						expect.objectContaining({
							startDate: expect.any(Date),
							endDate: expect.any(Date),
						}),
					],
				}),
			);
			expect(result).toHaveLength(1);
		});

		it("should skip createMany when educations array is empty", async () => {
			jest
				.spyOn(prisma.education, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.education, "createMany")
				.mockResolvedValue({ count: 0 });
			jest.spyOn(prisma.education, "findMany").mockResolvedValue([]);

			await service.replaceEducations("prof-1", []);

			expect(prisma.education.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.education.createMany).not.toHaveBeenCalled();
		});
	});

	describe("replaceCertifications", () => {
		it("should delete existing certifications and create new ones with date conversion", async () => {
			jest
				.spyOn(prisma.certification, "deleteMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.certification, "createMany")
				.mockResolvedValue({ count: 1 });
			jest
				.spyOn(prisma.certification, "findMany")
				.mockResolvedValue([{ id: "c1" }] as any);

			const result = await service.replaceCertifications("prof-1", [
				{
					name: "AWS",
					issuingOrganization: "Amazon",
					issueDate: "2023-01-01",
					expirationDate: "2026-01-01",
				},
			]);

			expect(prisma.certification.deleteMany).toHaveBeenCalledWith({
				where: { profileId: "prof-1" },
			});
			expect(prisma.certification.createMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: [
						expect.objectContaining({
							issueDate: expect.any(Date),
							expirationDate: expect.any(Date),
						}),
					],
				}),
			);
			expect(result).toHaveLength(1);
		});
	});

	describe("searchProfiles", () => {
		it("should return matching profiles for a valid query", async () => {
			const rawRows = [
				{
					id: "prof-1",
					user_id: "user-123",
					headline: "React Developer",
					about: "I build apps",
					location: "NY",
					website: null,
					open_to_work: true,
					recruiting_eligible: false,
					visibility: "PUBLIC",
					created_at: new Date(),
					updated_at: new Date(),
					rank: 0.9,
					total_count: 1,
				},
			];

			jest.spyOn(prisma, "$queryRaw").mockResolvedValue(rawRows as any);

			const result = await service.searchProfiles("react developer", 20, 0);

			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toEqual(
				expect.objectContaining({
					id: "prof-1",
					userId: "user-123",
					headline: "React Developer",
					about: "I build apps",
					location: "NY",
					openToWork: true,
					recruitingEligible: false,
					visibility: "PUBLIC",
					rank: 0.9,
				}),
			);
			expect(result.meta.total).toBe(1);
			expect(result.meta.limit).toBe(20);
			expect(result.meta.offset).toBe(0);
		});

		it("should return empty result for empty sanitized query", async () => {
			const result = await service.searchProfiles("!!!", 20, 0);
			expect(result.data).toEqual([]);
			expect(result.meta.total).toBe(0);
		});

		it("should apply limit and offset", async () => {
			const rawRows = [
				{
					id: "prof-2",
					user_id: "user-456",
					headline: "Senior React Developer",
					about: null,
					location: "SF",
					website: null,
					open_to_work: false,
					recruiting_eligible: true,
					visibility: "PUBLIC",
					created_at: new Date(),
					updated_at: new Date(),
					rank: 0.8,
					total_count: 10,
				},
			];

			jest.spyOn(prisma, "$queryRaw").mockResolvedValue(rawRows as any);

			const result = await service.searchProfiles("react", 5, 10);

			expect(result.meta.limit).toBe(5);
			expect(result.meta.offset).toBe(10);
			expect(result.meta.total).toBe(10);
		});
	});
});
