import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import type { AppConfig } from "../infra/config/app-config";
import { PrismaService } from "../infra/prisma/prisma.service";
import { StorageService } from "../infra/storage/storage.service";
import type { InitiateUploadDto } from "./dto/initiate-upload.dto";

@Injectable()
export class MediaService {
	constructor(
		private readonly config: ConfigService<AppConfig, true>,
		private readonly prisma: PrismaService,
		private readonly storage: StorageService,
	) {}

	async initiateUpload(user: AuthenticatedUser, dto: InitiateUploadDto) {
		const { purpose, filename, contentType, sizeBytes } = dto;

		// Validate content type
		const allowedContentTypes = this.config.get("mediaAllowedContentTypes", {
			infer: true,
		});
		if (!allowedContentTypes.includes(contentType)) {
			throw new BadRequestException("Content type not allowed");
		}

		// Validate size
		if (sizeBytes !== undefined) {
			const maxSizeBytes = this.getMaxSizeBytes(purpose);
			if (sizeBytes > maxSizeBytes) {
				throw new BadRequestException("File size exceeds maximum allowed");
			}
		}

		const bucket = this.config.get("s3Bucket", { infer: true });
		const s3Key = `${purpose}/${randomUUID()}-${filename}`;

		const mediaAsset = await this.prisma.mediaAsset.create({
			data: {
				ownerId: user.id,
				purpose,
				filename,
				s3Key,
				s3Bucket: bucket,
				contentType,
				sizeBytes: sizeBytes ?? null,
				status: "PENDING",
			},
		});

		const uploadUrl = await this.storage.generatePresignedUploadUrl(
			bucket,
			s3Key,
			{
				contentType,
				contentLength: sizeBytes,
				expiresInSeconds: 300,
			},
		);

		return {
			mediaId: mediaAsset.id,
			uploadUrl,
			expiresIn: 300,
		};
	}

	async confirmUpload(user: AuthenticatedUser, mediaId: string) {
		const asset = await this.prisma.mediaAsset.findUnique({
			where: { id: mediaId },
		});

		if (!asset) {
			throw new NotFoundException("Media asset not found");
		}

		if (asset.ownerId !== user.id) {
			throw new ForbiddenException("You do not own this media asset");
		}

		const metadata = await this.storage.verifyObject(
			asset.s3Bucket,
			asset.s3Key,
		);

		if (!metadata) {
			throw new BadRequestException("Upload not completed or object not found");
		}

		if (metadata.contentType !== asset.contentType) {
			throw new BadRequestException("Content type mismatch");
		}

		const updated = await this.prisma.mediaAsset.update({
			where: { id: mediaId },
			data: {
				status: "READY",
				etag: metadata.etag,
				sizeBytes: metadata.contentLength,
			},
		});

		return updated;
	}

	private getMaxSizeBytes(purpose: string): number {
		switch (purpose) {
			case "avatar":
				return this.config.get("mediaAvatarMaxSizeBytes", { infer: true });
			case "resume":
				return this.config.get("mediaResumeMaxSizeBytes", { infer: true });
			case "attachment":
				return this.config.get("mediaResumeMaxSizeBytes", { infer: true });
			default:
				return this.config.get("mediaResumeMaxSizeBytes", { infer: true });
		}
	}
}
