export function encodeScoreCursor(score: number, id: string): string {
	return Buffer.from(JSON.stringify({ score, id })).toString("base64");
}

export function decodeScoreCursor(
	cursor: string,
): { score: number; id: string } | null {
	try {
		const decoded = JSON.parse(
			Buffer.from(cursor, "base64").toString("utf8"),
		) as { score?: number; id?: string };
		if (typeof decoded?.score !== "number" || !decoded?.id) return null;
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
	meta: { nextCursor?: string; hasMore: boolean; limit: number };
} {
	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;
	const last = items.at(-1);
	const nextCursor =
		hasMore && last ? encodeScoreCursor(last.score, last.id) : undefined;
	return { data: items, meta: { nextCursor, hasMore, limit } };
}
