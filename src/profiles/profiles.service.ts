import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProfileVisibility } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { CertificationDto } from './dto/certification.dto';
import type { EducationDto } from './dto/education.dto';
import type { ExperienceDto } from './dto/experience.dto';
import type { LanguageDto } from './dto/language.dto';
import type { SkillDto } from './dto/skill.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

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
    error.code === 'P2002'
  );
}

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
    const {
      skills,
      experiences,
      educations,
      certifications,
      languages,
      ...profileData
    } = data;

    let profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await this.prisma.profile.create({
        data: { userId: user.id, ...profileData },
      });
    } else if (Object.keys(profileData).length > 0) {
      profile = await this.prisma.profile.update({
        where: { userId: user.id },
        data: profileData,
      });
    }

    if (skills !== undefined) await this.replaceSkills(profile.id, skills);
    if (experiences !== undefined)
      await this.replaceExperiences(profile.id, experiences);
    if (educations !== undefined)
      await this.replaceEducations(profile.id, educations);
    if (certifications !== undefined)
      await this.replaceCertifications(profile.id, certifications);
    if (languages !== undefined)
      await this.replaceLanguages(profile.id, languages);

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
      userRecord.status === 'DELETED' ||
      userRecord.status === 'DISABLED'
    ) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId: targetUserId },
      include: PROFILE_INCLUDES,
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
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
            'Experience startDate must be before endDate',
          );
        }
      }
      if (e.isCurrent && e.endDate !== undefined && e.endDate !== null) {
        throw new BadRequestException(
          'Experience with isCurrent=true must have endDate set to null',
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
              'Duplicate skill name for this profile',
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
            throw new ConflictException('Duplicate language for this profile');
          }
          throw error;
        }
      }
      return tx.profileLanguage.findMany({ where: { profileId } });
    });
  }
}
