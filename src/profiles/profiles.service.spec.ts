import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ProfileVisibility } from "@prisma/client";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ProfilesService } from "./profiles.service";

describe("ProfilesService", () => {
	let service: ProfilesService;
	let prisma: PrismaService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ProfilesService,
				{
					provide: PrismaService,
					useValue: {
						profile: {
							findUnique: jest.fn(),
							create: jest.fn(),
							update: jest.fn(),
						},
						user: {
							findUnique: jest.fn(),
						},
					},
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

			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValue(profile as any);

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

			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(null);
			jest.spyOn(prisma.profile, "create").mockResolvedValue(created as any);

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

			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValue(existing as any);
			jest.spyOn(prisma.profile, "update").mockResolvedValue(updated as any);

			const result = await service.updateOwnProfile(user, {
				headline: "New Headline",
			});
			expect(result.headline).toBe("New Headline");
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

			jest.spyOn(prisma.profile, "findUnique").mockResolvedValue(null);
			jest.spyOn(prisma.profile, "create").mockResolvedValue(created as any);

			const result = await service.updateOwnProfile(user, {
				headline: "Headline",
			});
			expect(result.headline).toBe("Headline");
			expect(prisma.profile.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { userId: "user-123", headline: "Headline" },
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
			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValue(profile as any);

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
			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValue(profile as any);

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
			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValue(profile as any);

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
			jest
				.spyOn(prisma.profile, "findUnique")
				.mockResolvedValue(profile as any);

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
});
