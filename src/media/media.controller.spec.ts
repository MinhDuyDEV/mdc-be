import { Test, type TestingModule } from "@nestjs/testing";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

describe("MediaController", () => {
	let controller: MediaController;
	let mediaService: MediaService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [MediaController],
			providers: [
				{
					provide: MediaService,
					useValue: {
						initiateUpload: jest.fn(),
						confirmUpload: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<MediaController>(MediaController);
		mediaService = module.get<MediaService>(MediaService);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	describe("POST /media/initiate", () => {
		it("should call mediaService.initiateUpload", async () => {
			const user = { id: "user-123" };
			const dto = {
				purpose: "avatar",
				filename: "profile.jpg",
				contentType: "image/jpeg",
				sizeBytes: 1024,
			};

			const response = {
				mediaId: "media-123",
				uploadUrl: "https://presigned-url",
				expiresIn: 300,
			};

			jest.spyOn(mediaService, "initiateUpload").mockResolvedValue(response);

			const result = await controller.initiateUpload(user as any, dto);

			expect(mediaService.initiateUpload).toHaveBeenCalledWith(user, dto);
			expect(result).toEqual(response);
		});
	});

	describe("POST /media/:id/confirm", () => {
		it("should call mediaService.confirmUpload", async () => {
			const user = { id: "user-123" };
			const id = "media-123";
			const dto = {};

			const response = { id, status: "READY" };

			jest
				.spyOn(mediaService, "confirmUpload")
				.mockResolvedValue(response as any);

			const result = await controller.confirmUpload(user as any, id, dto);

			expect(mediaService.confirmUpload).toHaveBeenCalledWith(user, id);
			expect(result).toEqual(response);
		});
	});
});
