import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma, ProfileVisibility } from "@prisma/client";
import type { AuthenticatedUser } from "../common/auth/current-user.interface";
import { PrismaService } from "../infra/prisma/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import type { CertificationDto } from "./dto/certification.dto";
import type { EducationDto } from "./dto/education.dto";
import type { ExperienceDto } from "./dto/experience.dto";
import type { LanguageDto } from "./dto/language.dto";
import type { SkillDto } from "./dto/skill.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

const PROFILE_INCLUDES = {
	skills: true,
	experiences: true,
	educations: true,
	certifications: true,
	languages: true,
	endorsements: true,
} as const;

function isPrismaUniqueViolation(
	error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

@Injectable()
export class ProfilesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly outboxService: OutboxService,
	) {}

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
		const {
			skills,
			experiences,
			educations,
			certifications,
			languages,
			...profileData
		} = data;

		let profileId: string;

		await this.prisma.$transaction(async (tx) => {
			let profile = await tx.profile.findUnique({
				where: { userId: user.id },
			});

			if (!profile) {
				profile = await tx.profile.create({
					data: { userId: user.id, ...profileData },
				});
			} else if (Object.keys(profileData).length > 0) {
				profile = await tx.profile.update({
					where: { userId: user.id },
					data: profileData,
				});
			}

			profileId = profile.id;

			// Emit ProfileUpdated event
			await this.outboxService.emit(tx as any, {
				eventType: "ProfileUpdated",
				aggregateType: "Profile",
				aggregateId: profile.id,
				payload: { profileId: profile.id, userId: user.id },
			});
		});

		// Sub-entity replacements (outside tx since they're independent)
		if (skills !== undefined) await this.replaceSkills(profileId!, skills);
		if (experiences !== undefined)
			await this.replaceExperiences(profileId!, experiences);
		if (educations !== undefined)
			await this.replaceEducations(profileId!, educations);
		if (certifications !== undefined)
			await this.replaceCertifications(profileId!, certifications);
		if (languages !== undefined)
			await this.replaceLanguages(profileId!, languages);

		return this.prisma.profile.findUnique({
			where: { userId: user.id },
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

	private validateExperiences(experiences: ExperienceDto[]) {
		for (const e of experiences) {
			const start = new Date(e.startDate);
			if (e.endDate) {
				const end = new Date(e.endDate);
				if (start >= end) {
					throw new BadRequestException(
						"Experience startDate must be before endDate",
					);
				}
			}
			if (e.isCurrent && e.endDate !== undefined && e.endDate !== null) {
				throw new BadRequestException(
					"Experience with isCurrent=true must have endDate set to null",
				);
			}
		}
	}

	async replaceSkills(profileId: string, skills: SkillDto[]) {
		return this.prisma.$transaction(async (tx) => {
			await tx.profileSkill.deleteMany({ where: { profileId } });
			if (skills.length > 0) {
				try {
					await tx.profileSkill.createMany({
						data: skills.map((s) => ({ profileId, ...s })),
						skipDuplicates: true,
					});
				} catch (error) {
					if (isPrismaUniqueViolation(error)) {
						throw new ConflictException(
							"Duplicate skill name for this profile",
						);
					}
					throw error;
				}
			}
			return tx.profileSkill.findMany({ where: { profileId } });
		});
	}

	async replaceExperiences(profileId: string, experiences: ExperienceDto[]) {
		this.validateExperiences(experiences);
		return this.prisma.$transaction(async (tx) => {
			await tx.experience.deleteMany({ where: { profileId } });
			if (experiences.length > 0) {
				await tx.experience.createMany({
					data: experiences.map((e) => ({
						profileId,
						title: e.title,
						company: e.company,
						companyUrl: e.companyUrl,
						location: e.location,
						description: e.description,
						startDate: new Date(e.startDate),
						endDate: e.endDate ? new Date(e.endDate) : null,
						isCurrent: e.isCurrent ?? false,
					})),
					skipDuplicates: true,
				});
			}
			return tx.experience.findMany({ where: { profileId } });
		});
	}

	async replaceEducations(profileId: string, educations: EducationDto[]) {
		return this.prisma.$transaction(async (tx) => {
			await tx.education.deleteMany({ where: { profileId } });
			if (educations.length > 0) {
				await tx.education.createMany({
					data: educations.map((e) => ({
						profileId,
						school: e.school,
						degree: e.degree,
						fieldOfStudy: e.fieldOfStudy,
						startDate: new Date(e.startDate),
						endDate: e.endDate ? new Date(e.endDate) : null,
						grade: e.grade,
						activities: e.activities,
					})),
					skipDuplicates: true,
				});
			}
			return tx.education.findMany({ where: { profileId } });
		});
	}

	async replaceCertifications(
		profileId: string,
		certifications: CertificationDto[],
	) {
		return this.prisma.$transaction(async (tx) => {
			await tx.certification.deleteMany({ where: { profileId } });
			if (certifications.length > 0) {
				await tx.certification.createMany({
					data: certifications.map((c) => ({
						profileId,
						name: c.name,
						issuingOrganization: c.issuingOrganization,
						issueDate: new Date(c.issueDate),
						expirationDate: c.expirationDate
							? new Date(c.expirationDate)
							: null,
						credentialId: c.credentialId,
						credentialUrl: c.credentialUrl,
					})),
					skipDuplicates: true,
				});
			}
			return tx.certification.findMany({ where: { profileId } });
		});
	}

	async replaceLanguages(profileId: string, languages: LanguageDto[]) {
		return this.prisma.$transaction(async (tx) => {
			await tx.profileLanguage.deleteMany({ where: { profileId } });
			if (languages.length > 0) {
				try {
					await tx.profileLanguage.createMany({
						data: languages.map((l) => ({ profileId, ...l })),
						skipDuplicates: true,
					});
				} catch (error) {
					if (isPrismaUniqueViolation(error)) {
						throw new ConflictException("Duplicate language for this profile");
					}
					throw error;
				}
			}
			return tx.profileLanguage.findMany({ where: { profileId } });
		});
	}

	async searchProfiles(query: string, limit = 20, offset = 0) {
		// Sanitize query — allow only word chars, spaces, hyphens
		const sanitized = query.replace(/[^\w\s-]/g, "").trim();
		if (!sanitized) return { data: [], meta: { total: 0, limit, offset } };

		interface ProfileSearchResult {
			id: string;
			user_id: string;
			headline: string | null;
			about: string | null;
			location: string | null;
			website: string | null;
			open_to_work: boolean;
			recruiting_eligible: boolean;
			visibility: string;
			created_at: Date;
			updated_at: Date;
			rank: number;
			total_count: number;
		}

		const rows = await this.prisma.$queryRaw<ProfileSearchResult[]>`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${sanitized}) AS query
      ),
      matched AS (
        SELECT
          p.id,
          p.user_id,
          p.headline,
          p.about,
          p.location,
          p.website,
          p.open_to_work,
          p.recruiting_eligible,
          p.visibility,
          p.created_at,
          p.updated_at,
          ts_rank(p.search_vector, sq.query) AS rank,
          COUNT(*) OVER() AS total_count
        FROM "profiles" p, search_query sq
        WHERE p.search_vector @@ sq.query
          AND p.visibility = 'PUBLIC'
        ORDER BY rank DESC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT * FROM matched
    `;

		const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

		return {
			data: rows.map((r) => ({
				id: r.id,
				userId: r.user_id,
				headline: r.headline,
				about: r.about,
				location: r.location,
				website: r.website,
				openToWork: r.open_to_work,
				recruitingEligible: r.recruiting_eligible,
				visibility: r.visibility,
				createdAt: r.created_at,
				updatedAt: r.updated_at,
				rank: Number(r.rank),
			})),
			meta: { total, limit, offset },
		};
	}

	async endorseSkill(skillId: string, endorser: AuthenticatedUser) {
		// Find the skill and its profile
		const skill = await this.prisma.profileSkill.findUnique({
			where: { id: skillId },
			include: { profile: true },
		});

		if (!skill) {
			throw new NotFoundException("Skill not found");
		}

		// Prevent self-endorsement
		if (skill.profile.userId === endorser.id) {
			throw new BadRequestException("You cannot endorse your own skills");
		}

		// Create endorsement (unique constraint prevents duplicates)
		try {
			const endorsement = await this.prisma.endorsement.create({
				data: {
					profileId: skill.profileId,
					profileSkillId: skillId,
					endorserId: endorser.id,
				},
			});
			return endorsement;
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException("You have already endorsed this skill");
			}
			throw error;
		}
	}

	async removeEndorsement(skillId: string, endorser: AuthenticatedUser) {
		const endorsement = await this.prisma.endorsement.findUnique({
			where: {
				profileSkillId_endorserId: {
					profileSkillId: skillId,
					endorserId: endorser.id,
				},
			},
		});

		if (!endorsement) {
			throw new NotFoundException("Endorsement not found");
		}

		await this.prisma.endorsement.delete({
			where: { id: endorsement.id },
		});

		return { deleted: true };
	}
}
