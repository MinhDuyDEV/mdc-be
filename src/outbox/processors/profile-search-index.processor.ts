import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

interface ProfileUpdatedPayload {
	profileId: string;
	userId: string;
}

@Injectable()
export class ProfileSearchIndexProcessor {
	private readonly logger = new Logger(ProfileSearchIndexProcessor.name);

	/**
	 * Handles ProfileUpdated events.
	 * Note: FTS triggers in Postgres handle search indexing automatically.
	 * This processor is for future Elasticsearch indexing.
	 */
	@Cron(CronExpression.EVERY_10_SECONDS, {
		name: "profile-search-index-processor",
		waitForCompletion: true,
	})
	async handleProfileUpdated(): Promise<void> {
		this.logger.debug(
			"Profile search index processor tick (no-op in current phase)",
		);
	}

	async processProfileUpdated(_payload: ProfileUpdatedPayload): Promise<void> {
		// TODO: Implement in future phase when Elasticsearch is wired
		// Search indexing is currently handled by Postgres FTS triggers
	}
}
