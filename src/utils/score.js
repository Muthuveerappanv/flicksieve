// The one true Sieve Score.
//
// Historically this logic was copy-pasted into seven components and one copy
// (OttTracker) used the RT *critic* score where every other used RT *audience*,
// so the same title showed two different stars on two tabs. Import from here.

const has = (v) => v !== undefined && v !== null;

/**
 * Average of the available rating pillars, normalised to a 0–5 scale:
 *   - IMDb        (0–10)  → /2
 *   - RT Audience (0–100) → /20
 *   - Letterboxd  (0–5)   → as-is
 *   - For TV with no Letterboxd score, RT Critics (0–100) → /20 stands in.
 *
 * @param {object} show  a show record with a `ratings` object and a `type`
 * @returns {number} the mean of the available pillars, or 0 when none are set
 */
export function calculateSieveScore(show) {
  const ratings = show?.ratings || {};
  let total = 0;
  let count = 0;

  if (has(ratings.imdb)) {
    total += ratings.imdb / 2;
    count++;
  }
  if (has(ratings.rottenTomatoesAudience)) {
    total += ratings.rottenTomatoesAudience / 20;
    count++;
  }

  if (has(ratings.letterboxd)) {
    total += ratings.letterboxd;
    count++;
  } else if (show?.type === 'tv' && has(ratings.rottenTomatoes)) {
    total += ratings.rottenTomatoes / 20;
    count++;
  }

  return count > 0 ? total / count : 0;
}

/** True when a show has no usable rating from any source. */
export function isUnrated(show) {
  const r = show?.ratings || {};
  return !has(r.imdb) && !has(r.rottenTomatoes) && !has(r.rottenTomatoesAudience) && !has(r.letterboxd);
}

/** Convenience: the score formatted for display, or 'N/A' when unrated. */
export function formatSieveScore(show) {
  if (isUnrated(show)) return 'N/A';
  return calculateSieveScore(show).toFixed(2);
}
