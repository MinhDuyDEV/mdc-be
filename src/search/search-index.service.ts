import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, type PinoLogger } from "nestjs-pino";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { SearchEngineService } from "../infra/search-engine";

/**
 * Elasticsearch indexing facade consumed by outbox processors
 * in later phases. Domain modules call index/delete/search here
 * instead of importing the Elasticsearch SDK directly.
 */
@Injectable()
export class SearchIndexService {
	constructor(
    private readonly searchEngine: SearchEngineService,
    private readonly prisma: PrismaService,
    @InjectPinoLogger(SearchIndexService.name)
    private readonly logger: PinoLogger,
  ) {}

	/**
	 * Index a document in Elasticsearch.
	 * Falls back gracefully: logs a warning if ES is unavailable.
	 */
	async indexDocument(
		index: string,
		id: string,
		body: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.searchEngine.index(index, id, body);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(
				`SearchIndexService: failed to index document ${id} in ${index}: ${message}`,
			);
		}
	}

	/**
	 * Remove documents matching a query.
	 */
	async deleteByQuery(
		index: string,
		query: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.searchEngine.deleteByQuery(index, query);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(
				`SearchIndexService: failed to delete from ${index}: ${message}`,
			);
		}
	}

	/**
	 * Search documents in Elasticsearch.
	 */
	async search(
		index: string,
		query: Record<string, unknown>,
	): Promise<unknown> {
		return this.searchEngine.search(index, query);
	}

	/**
	 * Create a search index with entity-specific mappings, index settings,
	 * and atomic read/write alias assignment.
	 *
	 * The read alias (e.g. `jobs`) is used by query processors for stable
	 * index resolution.  The write alias (`jobs-write`) enables zero-downtime
	 * reindex — outbox processors write to the write alias, and a reindex
	 * swaps it atomically.
	 */
	async createSearchIndex(
		entityType: "profiles" | "companies" | "jobs" | "posts",
		version: number = 1,
	): Promise<void> {
		const indexName = `${entityType}-v${version}`;
		const writeAlias = `${entityType}-write`;
		const readAlias = entityType;

		const mappings = this.getEntityMappings(entityType);
		const settings = this.getIndexSettings();

		try {
			await this.searchEngine.createIndex(indexName, mappings, settings);
			this.logger.info({ indexName }, "Created search index");

			await this.searchEngine.updateAliases([
				{ add: { index: indexName, alias: writeAlias, is_write_index: true } },
				{ add: { index: indexName, alias: readAlias } },
			]);
			this.logger.info(
				{ indexName, writeAlias, readAlias },
				"Created index aliases",
			);
		} catch (error) {
			this.logger.error({ error, indexName }, "Failed to create search index");
			throw error;
		}
	}

	/**
	 * Perform a zero-downtime reindex for a given entity type.
	 *
	 * 1. Creates a new versioned index with reindex-optimised settings.
	 * 2. Bulk-indexes documents from the database.
	 * 3. Swaps the write alias to the new index.
	 * 4. Atomically swaps the read alias — queries roll over transparently.
	 * 5. Records the run outcome in the `SearchReindexRun` table.
	 */
	async reindexEntity(
		entityType: "profiles" | "companies" | "jobs" | "posts",
		triggeredBy: string,
	): Promise<string> {
		const runId = `reindex-${entityType}-${Date.now()}`;
		const currentVersion = 1;
		const newVersion = currentVersion + 1;
		const oldIndex = `${entityType}-v${currentVersion}`;
		const newIndex = `${entityType}-v${newVersion}`;

		try {
			await this.prisma.searchReindexRun.create({
				data: {
					id: runId,
					entityType,
					oldIndex,
					newIndex,
					status: "in_progress",
					triggeredBy,
				},
			});

			const startTime = Date.now();

			// Create new index with bulk-friendly settings (no replicas,
			// refresh disabled — we'll re-enable after swapping aliases).
			await this.searchEngine.createIndex(
				newIndex,
				this.getEntityMappings(entityType),
				{
					number_of_shards: 1,
					number_of_replicas: 0,
					"index.refresh_interval": "-1",
				},
			);

			// Bulk reindex from database (stub — returns 0 until Phase 9c)
			const documentCount = await this.bulkReindexFromDatabase(
				entityType,
				newIndex,
			);

			// Swap write alias first so new documents flow to the new index
			await this.searchEngine.updateAliases([
				{
					add: {
						index: newIndex,
						alias: `${entityType}-write`,
						is_write_index: true,
					},
				},
				{ remove: { index: oldIndex, alias: `${entityType}-write` } },
			]);

			// Atomic read alias swap — queries seamlessly roll over
			await this.searchEngine.updateAliases([
				{ remove: { index: oldIndex, alias: entityType } },
				{ add: { index: newIndex, alias: entityType } },
			]);

			const durationMs = Date.now() - startTime;

			await this.prisma.searchReindexRun.update({
				where: { id: runId },
				data: {
					status: "completed",
					documentCount,
					durationMs,
					completedAt: new Date(),
				},
			});

			this.logger.info(
				{ runId, entityType, documentCount, durationMs },
				"Reindex completed",
			);
			return runId;
		} catch (error) {
			await this.prisma.searchReindexRun
				.update({
					where: { id: runId },
					data: {
						status: "failed",
						error: String(error),
						completedAt: new Date(),
					},
				})
				.catch(() => {});
			this.logger.error({ error, runId, entityType }, "Reindex failed");
			throw error;
		}
	}

	/**
	 * Return Elasticsearch field mappings for a given entity type.
	 * Field names correspond to the payload keys used by outbox
	 * processors (e.g. `salaryCurrency`, `workplaceType` for jobs).
	 */
	private getEntityMappings(entityType: string): Record<string, unknown> {
		const commonFields: Record<string, { type: string }> = {
			id: { type: "keyword" },
			createdAt: { type: "date" },
			updatedAt: { type: "date" },
		};

		const entityMappings: Record<
			string,
			{ properties: Record<string, unknown> }
		> = {
			profiles: {
				properties: {
					...commonFields,
					userId: { type: "keyword" },
					displayName: {
						type: "text",
						fields: { keyword: { type: "keyword" } },
					},
					headline: { type: "text", analyzer: "english" },
					about: { type: "text", analyzer: "english" },
					location: { type: "text" },
					skills: { type: "keyword" },
					visibility: { type: "keyword" },
				},
			},
			companies: {
				properties: {
					...commonFields,
					name: {
						type: "text",
						fields: { keyword: { type: "keyword" } },
					},
					industry: { type: "text" },
					description: { type: "text", analyzer: "english" },
					location: { type: "text" },
					size: { type: "keyword" },
					website: { type: "keyword" },
				},
			},
			jobs: {
				properties: {
					...commonFields,
					title: {
						type: "text",
						fields: { keyword: { type: "keyword" } },
					},
					description: { type: "text", analyzer: "english" },
					companyId: { type: "keyword" },
					companyName: {
						type: "text",
						fields: { keyword: { type: "keyword" } },
					},
					location: { type: "text" },
					salaryMin: { type: "integer" },
					salaryMax: { type: "integer" },
					salaryCurrency: { type: "keyword" },
					employmentType: { type: "keyword" },
					workplaceType: { type: "keyword" },
					skills: { type: "keyword" },
					status: { type: "keyword" },
				},
			},
			posts: {
				properties: {
					...commonFields,
					authorId: { type: "keyword" },
					authorName: {
						type: "text",
						fields: { keyword: { type: "keyword" } },
					},
					content: { type: "text", analyzer: "english" },
					hashtags: { type: "keyword" },
					visibility: { type: "keyword" },
					reactionCount: { type: "integer" },
					commentCount: { type: "integer" },
				},
			},
		};

		return entityMappings[entityType] ?? { properties: commonFields };
	}

	/**
	 * Default index settings with an edge-ngram autocomplete analyzer.
	 */
	private getIndexSettings(): Record<string, unknown> {
		return {
			number_of_shards: 1,
			number_of_replicas: 1,
			"index.refresh_interval": "30s",
			analysis: {
				analyzer: {
					autocomplete: {
						tokenizer: "autocomplete",
						filter: ["lowercase"],
					},
				},
				tokenizer: {
					autocomplete: {
						type: "edge_ngram",
						min_gram: 2,
						max_gram: 20,
						token_chars: ["letter", "digit"],
					},
				},
			},
		};
	}

	/**
	 * Stub:  bulk-indexes documents from the database into the target
	 * Elasticsearch index.  Returns the number of documents indexed.
	 *
	 * TODO(Phase 9c):  Wire up actual database queries + searchEngine.bulkIndex().
	 */
	private async bulkReindexFromDatabase(
		entityType: string,
		targetIndex: string,
	): Promise<number> {
		this.logger.warn(
			{ entityType, targetIndex },
			"Bulk reindex not yet implemented",
		);
		return 0;
	}
}
