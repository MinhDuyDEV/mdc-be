/**
 * Extract @mentions from text
 * Pattern: @username (alphanumeric + underscore, 1-50 chars)
 * Negative lookbehind ensures @ is not preceded by a word char (e.g. email@example.com is excluded)
 * Returns: array of unique usernames (without @)
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const regex = /(?<!\w)@(\w{1,50})/g;
  const matches = Array.from(text.matchAll(regex));
  const usernames = matches.map((m) => m[1]);
  return Array.from(new Set(usernames)); // dedupe
}

/**
 * Extract #hashtags from text
 * Pattern: #tag (alphanumeric + underscore/hyphen, 1-50 chars)
 * Returns: array of unique normalized tags (lowercase, without #)
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const regex = /#(\w[\w_-]{0,49})/g;
  const matches = Array.from(text.matchAll(regex));
  const tags = matches.map((m) => m[1].toLowerCase());
  return Array.from(new Set(tags)); // dedupe + normalize
}
