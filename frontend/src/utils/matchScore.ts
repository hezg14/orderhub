/**
 * Palette match ranking — extracted from CommandPalette.vue so it can be unit
 * tested against the inputs an expert user actually types.
 *
 * Ranking, not filtering: prefix > substring > subsequence. The subsequence
 * pass is what lets "orlst" find "Order list" the way an expert types.
 */

/**
 * Score `needle` against `haystack`. Higher is better; -1 means no match.
 * - 1000  prefix match
 * - ~700  substring match (earlier is better)
 * - small sums for subsequence matches, rewarding consecutive streaks and
 *   early hits, penalising characters found deep in the haystack
 */
export function matchScore(needle: string, haystack: string): number {
  if (!needle) return 0;
  const q = needle.toLowerCase();
  const h = haystack.toLowerCase();
  const direct = h.indexOf(q);
  if (direct === 0) return 1000;
  if (direct > 0) return 700 - direct;

  let cursor = 0;
  let total = 0;
  let streak = 0;
  for (const ch of q) {
    const at = h.indexOf(ch, cursor);
    if (at === -1) return -1;
    streak = at === cursor ? streak + 1 : 1;
    total += 8 + streak * 4 - Math.min(at, 20);
    cursor = at + 1;
  }
  return total;
}

/**
 * Best score of an item across its searchable fields. -1 when nothing matches.
 */
export function bestMatchScore(
  needle: string,
  fields: { label: string; keywords?: string; meta?: string },
): number {
  return Math.max(
    matchScore(needle, fields.label),
    matchScore(needle, fields.keywords ?? ''),
    matchScore(needle, fields.meta ?? ''),
  );
}
