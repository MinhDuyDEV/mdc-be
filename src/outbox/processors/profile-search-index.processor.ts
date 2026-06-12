import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SearchIndexService } from '../../search/search-index.service';

interface ProfileUpdatedPayload {
  profileId: string;
  userId: string;
}

interface ProfileRemovedPayload {
  profileId: string;
}

@Injectable()
export class ProfileSearchIndexProcessor {
  private readonly logger = new Logger(ProfileSearchIndexProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
  ) {}

  async processProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    // Skip soft-deleted profiles — we never want moderation-removed
    // profiles to remain in the search index.
    const profile = await this.prisma.profile.findFirst({
      where: { id: payload.profileId, deletedAt: null },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
        skills: {
          select: { name: true },
        },
      },
    });

    if (!profile) {
      this.logger.warn(
        `Profile ${payload.profileId} not found for indexing — skipping`,
      );
      return;
    }

    // Only index public profiles
    if (profile.visibility === 'PUBLIC') {
      await this.searchIndex.indexDocument('profiles', profile.id, {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.user.displayName,
        headline: profile.headline,
        about: profile.about,
        location: profile.location,
        skills: profile.skills.map((s) => s.name),
        visibility: profile.visibility,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      });

      this.logger.log(`Indexed profile ${profile.id} in ES`);
    } else {
      // Remove non-public profiles from ES
      await this.searchIndex.deleteByQuery('profiles', {
        term: { id: profile.id },
      });
      this.logger.log(`Removed non-public profile ${profile.id} from ES`);
    }
  }

  /**
   * Remove a soft-deleted profile from the Elasticsearch index.
   *
   * Called when a ProfileRemoved outbox event is dispatched (moderation
   * REMOVE_CONTENT on a PROFILE target). Unlike processProfileUpdated,
   * this method does NOT filter by deletedAt because the profile row
   * already has deletedAt set.
   */
  async processProfileRemoved(payload: ProfileRemovedPayload): Promise<void> {
    await this.searchIndex.deleteByQuery('profiles', {
      term: { id: payload.profileId },
    });
    this.logger.log(
      `Removed soft-deleted profile ${payload.profileId} from ES index`,
    );
  }
}
