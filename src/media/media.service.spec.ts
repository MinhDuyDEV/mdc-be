import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../infra/prisma/prisma.service";
import { StorageService } from "../infra/storage/storage.service";
import { MediaService } from "./media.service";

describe("MediaService", () => {
	let service: MediaService;
	let prisma: PrismaService;
	let storage: StorageService;
	let config: ConfigService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MediaService,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn((key: string) => {
							const map: Record<string, unknown> = {
								mediaAllowedContentTypes: ["image/jpeg", "image/png"],
								mediaAvatarMaxSizeBytes: 5 * 1024 * 1024,
								mediaResumeMaxSizeBytes: 20 * 1024 * 1024,
								s3Bucket: "test-bucket",
							};
							return map[key];
						}),
					},
				},
				{
					provide: PrismaService,
					useValue: {
						mediaAsset: {
							create: jest.fn(),
							findUnique: jest.fn(),
							update: jest.fn(),
						},
					},
				},
				{
					provide: StorageService,
					useValue: {
						generatePresignedUploadUrl: jest.fn(),
						verifyObject: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<MediaService>(MediaService);
		prisma = module.get<PrismaService>(PrismaService);
		storage = module.get<StorageService>(StorageService);
		config = module.get<ConfigService>(ConfigService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("initiateUpload", () => {
		it("should create media asset and return presigned URL", async () => {
			const user = { id: "user-123" };
			const dto = {
				purpose: "avatar",
				filename: "profile.jpg",
				contentType: "image/jpeg",
				sizeBytes: 1024,
			};

			const mediaAsset = {
				id: "media-123",
				ownerId: user.id,
				purpose: dto.purpose,
				filename: dto.filename,
				s3Key: "avatar/test-key-profile.jpg",
				s3Bucket: "test-bucket",
				contentType: dto.contentType,
				sizeBytes: dto.sizeBytes,
				status: "PENDING",
			};

			jest
				.spyOn(prisma.mediaAsset, "create")
				.mockResolvedValue(mediaAsset as any);
			jest
				.spyOn(storage, "generatePresignedUploadUrl")
				.mockResolvedValue("https://presigned-url");

			const result = await service.initiateUpload(user as any, dto);

			expect(prisma.mediaAsset.create).toHaveBeenCalled();
			expect(storage.generatePresignedUploadUrl).toHaveBeenCalledWith(
				"test-bucket",
				expect.stringContaining("avatar/"),
				{
					contentType: "image/jpeg",
					contentLength: 1024,
					expiresInSeconds: 300,
				},
			);
			expect(result).toEqual({
				mediaId: "media-123",
				uploadUrl: "https://presigned-url",
				expiresIn: 300,
			});
		});

		it("should throw BadRequestException for disallowed content type", async () => {
			const user = { id: "user-123" };
			const dto = {
				purpose: "avatar",
				filename: "profile.jpg",
				contentType: "application/exe",
				sizeBytes: 1024,
			};

			await expect(service.initiateUpload(user as any, dto)).rejects.toThrow(
				BadRequestException,
			);
		});

		it("should throw BadRequestException for oversized file", async () => {
			const user = { id: "user-123" };
			const dto = {
				purpose: "avatar",
				filename: "profile.jpg",
				contentType: "image/jpeg",
				sizeBytes: 10 * 1024 * 1024,
			};

			await expect(service.initiateUpload(user as any, dto)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe("confirmUpload", () => {
		it("should update media status to READY", async () => {
			const user = { id: "user-123" };
			const mediaId = "media-123";

			const asset = {
				id: mediaId,
				ownerId: user.id,
				s3Bucket: "test-bucket",
				s3Key: "avatar/test-key-profile.jpg",
				contentType: "image/jpeg",
				status: "PENDING",
			};

			const metadata = {
				contentLength: 1024,
				contentType: "image/jpeg",
				etag: '"abc123"',
				lastModified: new Date(),
			};

			const updated = {
				...asset,
				status: "READY",
				etag: metadata.etag,
				sizeBytes: metadata.contentLength,
			};

			jest
				.spyOn(prisma.mediaAsset, "findUnique")
				.mockResolvedValue(asset as any);
			jest.spyOn(storage, "verifyObject").mockResolvedValue(metadata);
			jest.spyOn(prisma.mediaAsset, "update").mockResolvedValue(updated as any);

			const result = await service.confirmUpload(user as any, mediaId);

			expect(prisma.mediaAsset.findUnique).toHaveBeenCalledWith({
				where: { id: mediaId },
			});
			expect(storage.verifyObject).toHaveBeenCalledWith(
				asset.s3Bucket,
				asset.s3Key,
			);
			expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
				where: { id: mediaId },
				data: {
					status: "READY",
					etag: metadata.etag,
					sizeBytes: metadata.contentLength,
				},
			});
			expect(result.status).toBe("READY");
		});

		it("should throw NotFoundException if media not found", async () => {
			jest.spyOn(prisma.mediaAsset, "findUnique").mockResolvedValue(null);

			await expect(
				service.confirmUpload({ id: "user-123" } as any, "missing"),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw ForbiddenException if not owner", async () => {
			const asset = {
				id: "media-123",
				ownerId: "other-user",
				s3Bucket: "test-bucket",
				s3Key: "avatar/test-key-profile.jpg",
				contentType: "image/jpeg",
				status: "PENDING",
			};

			jest
				.spyOn(prisma.mediaAsset, "findUnique")
				.mockResolvedValue(asset as any);

			await expect(
				service.confirmUpload({ id: "user-123" } as any, "media-123"),
			).rejects.toThrow(ForbiddenException);
		});

		it("should throw BadRequestException if object not in storage", async () => {
			const asset = {
				id: "media-123",
				ownerId: "user-123",
				s3Bucket: "test-bucket",
				s3Key: "avatar/test-key-profile.jpg",
				contentType: "image/jpeg",
				status: "PENDING",
			};

			jest
				.spyOn(prisma.mediaAsset, "findUnique")
				.mockResolvedValue(asset as any);
			jest.spyOn(storage, "verifyObject").mockResolvedValue(null);

			await expect(
				service.confirmUpload({ id: "user-123" } as any, "media-123"),
			).rejects.toThrow(BadRequestException);
		});

		it("should throw BadRequestException for content type mismatch", async () => {
			const asset = {
				id: "media-123",
				ownerId: "user-123",
				s3Bucket: "test-bucket",
				s3Key: "avatar/test-key-profile.jpg",
				contentType: "image/jpeg",
				status: "PENDING",
			};

			const metadata = {
				contentLength: 1024,
				contentType: "image/png",
				etag: '"abc123"',
				lastModified: new Date(),
			};

			jest
				.spyOn(prisma.mediaAsset, "findUnique")
				.mockResolvedValue(asset as any);
			jest.spyOn(storage, "verifyObject").mockResolvedValue(metadata);

			await expect(
				service.confirmUpload({ id: "user-123" } as any, "media-123"),
			).rejects.toThrow(BadRequestException);
		});
	});
});
