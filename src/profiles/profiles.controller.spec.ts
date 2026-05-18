import { Test, type TestingModule } from "@nestjs/testing";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

describe("ProfilesController", () => {
	let controller: ProfilesController;
	let profilesService: ProfilesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ProfilesController],
			providers: [
				{
					provide: ProfilesService,
					useValue: {
						getOwnProfile: jest.fn(),
						updateOwnProfile: jest.fn(),
						getPublicProfile: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<ProfilesController>(ProfilesController);
		profilesService = module.get<ProfilesService>(ProfilesService);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	describe("GET /profiles/me", () => {
		it("should call profilesService.getOwnProfile", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const profile = { id: "prof-1", userId: "user-123", headline: "Dev" };
			jest
				.spyOn(profilesService, "getOwnProfile")
				.mockResolvedValue(profile as any);

			const result = await controller.getMe(user);
			expect(result).toEqual(profile);
			expect(profilesService.getOwnProfile).toHaveBeenCalledWith(user);
		});
	});

	describe("PATCH /profiles/me", () => {
		it("should call profilesService.updateOwnProfile", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			const dto = { headline: "Updated" };
			jest
				.spyOn(profilesService, "updateOwnProfile")
				.mockResolvedValue({} as any);

			await controller.updateMe(user, dto);
			expect(profilesService.updateOwnProfile).toHaveBeenCalledWith(user, dto);
		});
	});

	describe("GET /profiles/:userId", () => {
		it("should call profilesService.getPublicProfile with userId and currentUser", async () => {
			const user = { id: "user-123", email: "test@example.com" };
			jest
				.spyOn(profilesService, "getPublicProfile")
				.mockResolvedValue({} as any);

			await controller.getProfile("user-456", user);
			expect(profilesService.getPublicProfile).toHaveBeenCalledWith(
				"user-456",
				user,
			);
		});

		it("should call profilesService.getPublicProfile with undefined currentUser when not provided", async () => {
			jest
				.spyOn(profilesService, "getPublicProfile")
				.mockResolvedValue({} as any);

			await controller.getProfile("user-456", undefined);
			expect(profilesService.getPublicProfile).toHaveBeenCalledWith(
				"user-456",
				undefined,
			);
		});
	});
});
