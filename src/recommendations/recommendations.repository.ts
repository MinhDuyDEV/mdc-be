import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

export function encodeScoreCursor(score: number, id: string): string {
  return Buffer.from(JSON.stringify({ score, id })).toString('base64');
}

export function decodeScoreCursor(
  cursor: string,
): { score: number; id: string } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    ) as {
      score?: number;
      id?: string;
    };
    if (typeof decoded?.score !== 'number' || !decoded?.id) return null;
    return { score: decoded.score, id: decoded.id };
  } catch {
    return null;
  }
}

export function paginateScored<T extends { score: number; id: string }>(
  rows: T[],
  limit: number,
): {
  data: T[];
  meta: { nextCursor?: string; hasNextPage: boolean; limit: number };
} {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor =
    hasNextPage && last ? encodeScoreCursor(last.score, last.id) : undefined;
  return { data: items, meta: { nextCursor, hasNextPage, limit } };
}

@Injectable()
export class RecommendationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPeopleRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Array<{ id: string; score: number }>> {
    const decoded = cursor ? decodeScoreCursor(cursor) : null;

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; score: number }>
    >(
      Prisma.sql`
        WITH user_connections AS (
          SELECT DISTINCT
            CASE
              WHEN requester_id = ${userId}::uuid THEN addressee_id
              WHEN addressee_id = ${userId}::uuid THEN requester_id
            END AS connection_id
          FROM connections
          WHERE (requester_id = ${userId}::uuid OR addressee_id = ${userId}::uuid)
            AND status = 'ACCEPTED'
        ),
        user_blocks AS (
          SELECT blocked_id AS blocked_user_id FROM blocks WHERE blocker_id = ${userId}::uuid
          UNION
          SELECT blocker_id AS blocked_user_id FROM blocks WHERE blocked_id = ${userId}::uuid
        ),
        second_degree_pre AS (
          SELECT
            CASE
              WHEN c2.requester_id = uc.connection_id THEN c2.addressee_id
              WHEN c2.addressee_id = uc.connection_id THEN c2.requester_id
            END AS candidate_id
          FROM user_connections uc
          JOIN connections c2 ON (c2.requester_id = uc.connection_id OR c2.addressee_id = uc.connection_id)
          WHERE c2.status = 'ACCEPTED'
        ),
        second_degree AS (
          SELECT
            candidate_id,
            COUNT(*) AS mutual_count
          FROM second_degree_pre sp
          WHERE sp.candidate_id != ${userId}::uuid
            AND sp.candidate_id NOT IN (SELECT connection_id FROM user_connections)
            AND sp.candidate_id NOT IN (SELECT blocked_user_id FROM user_blocks)
          GROUP BY candidate_id
        )
        SELECT
          sd.candidate_id AS id,
          sd.mutual_count::float AS score
        FROM second_degree sd
        JOIN users u ON u.id = sd.candidate_id
        JOIN profiles p ON p.user_id = u.id AND p.deleted_at IS NULL
        WHERE u.status = 'ACTIVE'
          AND p.visibility IN ('PUBLIC', 'CONNECTIONS_ONLY')
          ${decoded ? Prisma.sql`AND (sd.mutual_count < ${decoded.score} OR (sd.mutual_count = ${decoded.score} AND sd.candidate_id < ${decoded.id}::uuid))` : Prisma.empty}
        ORDER BY sd.mutual_count DESC, sd.candidate_id DESC
        LIMIT ${limit + 1}
      `,
    );

    return rows;
  }

  async findJobRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Array<{ id: string; score: number }>> {
    const decoded = cursor ? decodeScoreCursor(cursor) : null;

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; score: number }>
    >(
      Prisma.sql`
        WITH user_skills AS (
          SELECT ps.skill_id
          FROM profile_skills ps
          JOIN profiles p ON p.id = ps.profile_id
          WHERE p.user_id = ${userId}::uuid
        ),
        user_followed_companies AS (
          SELECT company_id FROM company_followers WHERE user_id = ${userId}::uuid
        ),
        user_applied_jobs AS (
          SELECT job_id FROM applications WHERE user_id = ${userId}::uuid
        ),
        user_blocks AS (
          SELECT blocked_id AS blocked_user_id FROM blocks WHERE blocker_id = ${userId}::uuid
          UNION
          SELECT blocker_id AS blocked_user_id FROM blocks WHERE blocked_id = ${userId}::uuid
        ),
        skill_matches AS (
          SELECT js.job_id, COUNT(*) AS match_count
          FROM job_skills js
          WHERE js.skill_id IN (SELECT skill_id FROM user_skills)
          GROUP BY js.job_id
        ),
        scored_jobs AS (
          SELECT
            j.id AS job_id,
            (
              COALESCE(sm.match_count, 0)
              + CASE WHEN j.company_id IN (SELECT company_id FROM user_followed_companies) THEN 5 ELSE 0 END
            )::float AS score
          FROM jobs j
          JOIN companies c ON c.id = j.company_id
          LEFT JOIN skill_matches sm ON sm.job_id = j.id
          WHERE j.status = 'PUBLISHED'
            AND j.deleted_at IS NULL
            AND c.deleted_at IS NULL
            AND j.id NOT IN (SELECT job_id FROM user_applied_jobs)
            AND j.company_id NOT IN (
              SELECT cm.company_id FROM company_members cm WHERE cm.user_id IN (SELECT blocked_user_id FROM user_blocks)
            )
        )
        SELECT
          sj.job_id AS id,
          sj.score
        FROM scored_jobs sj
        WHERE sj.score > 0
          ${decoded ? Prisma.sql`AND (sj.score < ${decoded.score} OR (sj.score = ${decoded.score} AND sj.job_id < ${decoded.id}::uuid))` : Prisma.empty}
        ORDER BY sj.score DESC, sj.job_id DESC
        LIMIT ${limit + 1}
      `,
    );

    return rows;
  }

  async findCompanyRecommendations(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Array<{ id: string; score: number }>> {
    const decoded = cursor ? decodeScoreCursor(cursor) : null;

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; score: number }>
    >(
      Prisma.sql`
        WITH user_connections AS (
          SELECT DISTINCT
            CASE
              WHEN requester_id = ${userId}::uuid THEN addressee_id
              WHEN addressee_id = ${userId}::uuid THEN requester_id
            END AS connection_id
          FROM connections
          WHERE (requester_id = ${userId}::uuid OR addressee_id = ${userId}::uuid)
            AND status = 'ACCEPTED'
        ),
        user_followed_companies AS (
          SELECT company_id FROM company_followers WHERE user_id = ${userId}::uuid
        ),
        scored_companies AS (
          SELECT
            c.id AS company_id,
            (
              (SELECT COUNT(*) FROM company_members cm WHERE cm.company_id = c.id AND cm.user_id IN (SELECT connection_id FROM user_connections))
            )::float AS score
          FROM companies c
          WHERE c.deleted_at IS NULL
            AND c.id NOT IN (SELECT company_id FROM user_followed_companies)
        )
        SELECT
          sc.company_id AS id,
          sc.score
        FROM scored_companies sc
        WHERE sc.score > 0
          ${decoded ? Prisma.sql`AND (sc.score < ${decoded.score} OR (sc.score = ${decoded.score} AND sc.company_id < ${decoded.id}::uuid))` : Prisma.empty}
        ORDER BY sc.score DESC, sc.company_id DESC
        LIMIT ${limit + 1}
      `,
    );

    return rows;
  }
}
