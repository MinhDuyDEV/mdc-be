import { Injectable, NotFoundException } from "@nestjs/common";
import { ProfileVisibility } from "@prisma/client";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import { PrismaService } from "../infra/prisma/prisma.service";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

const PROFILE_INCLUDES = {
	skills: true,
	experiences: true,
	educations: true,
	certifications: true,
	languages: true,
	endorsements: true,
} as const;

@Injectable()
export class ProfilesService {
	constructor(private readonly prisma: PrismaService) {}

	async getOwnProfile(user: AuthenticatedUser) {
		let profile = await this.prisma.profile.findUnique({
			where: { userId: user.id },
			include: PROFILE_INCLUDES,
		});

		if (!profile) {
			profile = await this.prisma.profile.create({
				data: { userId: user.id },
				include: PROFILE_INCLUDES,
			});
		}

		return profile;
	}

	async updateOwnProfile(user: AuthenticatedUser, data: UpdateProfileDto) {
		const existing = await this.prisma.profile.findUnique({
			where: { userId: user.id },
		});

		if (!existing) {
			return this.prisma.profile.create({
				data: { userId: user.id, ...data },
				include: PROFILE_INCLUDES,
			});
		}

		return this.prisma.profile.update({
			where: { userId: user.id },
			data,
			include: PROFILE_INCLUDES,
		});
	}

	async getPublicProfile(
		targetUserId: string,
		currentUser?: AuthenticatedUser,
	) {
		const userRecord = await this.prisma.user.findUnique({
			where: { id: targetUserId },
		});

		if (
			!userRecord ||
			userRecord.status === "DELETED" ||
			userRecord.status === "DISABLED"
		) {
			throw new NotFoundException("User not found");
		}

		const profile = await this.prisma.profile.findUnique({
			where: { userId: targetUserId },
			include: PROFILE_INCLUDES,
		});

		if (!profile) {
			throw new NotFoundException("Profile not found");
		}

		// Owner always gets full profile
		if (currentUser && currentUser.id === targetUserId) {
			return profile;
		}

		// Visibility filtering
		switch (profile.visibility) {
			case ProfileVisibility.PUBLIC:
				return {
					id: profile.id,
					userId: profile.userId,
					headline: profile.headline,
					about: profile.about,
					location: profile.location,
					website: profile.website,
					openToWork: profile.openToWork,
					recruitingEligible: profile.recruitingEligible,
					visibility: profile.visibility,
					createdAt: profile.createdAt,
					updatedAt: profile.updatedAt,
					skills: profile.skills,
					experiences: profile.experiences,
					educations: profile.educations,
					certifications: profile.certifications,
					languages: profile.languages,
					endorsements: profile.endorsements,
				};
			case ProfileVisibility.CONNECTIONS_ONLY:
				return {
					id: profile.id,
					userId: profile.userId,
					headline: profile.headline,
					location: profile.location,
					visibility: profile.visibility,
					createdAt: profile.createdAt,
					updatedAt: profile.updatedAt,
					skills: profile.skills,
				};
			case ProfileVisibility.PRIVATE:
			default:
				return {
					id: profile.id,
					userId: profile.userId,
					headline: profile.headline,
					visibility: profile.visibility,
					createdAt: profile.createdAt,
					updatedAt: profile.updatedAt,
				};
		}
	}
}
