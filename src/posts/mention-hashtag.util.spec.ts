import { extractHashtags, extractMentions } from "./mention-hashtag.util";

describe("extractMentions", () => {
	it("should extract single mention", () => {
		expect(extractMentions("Hello @john")).toEqual(["john"]);
	});

	it("should extract multiple mentions", () => {
		expect(extractMentions("@alice and @bob")).toEqual(["alice", "bob"]);
	});

	it("should deduplicate mentions", () => {
		expect(extractMentions("@alice @alice @bob")).toEqual(["alice", "bob"]);
	});

	it("should handle empty text", () => {
		expect(extractMentions("")).toEqual([]);
	});

	it("should ignore invalid patterns", () => {
		expect(extractMentions("email@example.com")).toEqual([]);
	});

	it("should handle underscores", () => {
		expect(extractMentions("@user_name")).toEqual(["user_name"]);
	});
});

describe("extractHashtags", () => {
	it("should extract single hashtag", () => {
		expect(extractHashtags("Post about #tech")).toEqual(["tech"]);
	});

	it("should extract multiple hashtags", () => {
		expect(extractHashtags("#tech #ai #ml")).toEqual(["tech", "ai", "ml"]);
	});

	it("should normalize to lowercase", () => {
		expect(extractHashtags("#Tech #TECH #tech")).toEqual(["tech"]);
	});

	it("should handle hyphens and underscores", () => {
		expect(extractHashtags("#machine-learning #deep_learning")).toEqual([
			"machine-learning",
			"deep_learning",
		]);
	});

	it("should handle empty text", () => {
		expect(extractHashtags("")).toEqual([]);
	});
});
