/**
 * Shared IMDb search-result match scoring.
 *
 * Given a candidate returned by IMDb's suggestion API and the metadata we
 * scraped for a title, return a similarity score. Higher is better. This is the
 * single source of truth for the heuristic that used to be copy-pasted into
 * vite.config.js (twice) and src/utils/api.js.
 *
 * @param {{primaryTitle?: string, startYear?: number|null, type?: string}} candidate
 * @param {{title?: string, year?: number|null, type?: string}} target
 *        `target.type` is the scraped media type: 'tv' means a series is wanted,
 *        anything else means a movie is wanted.
 * @returns {number}
 */
export function scoreImdbMatch(candidate, { title = '', year = null, type = 'movie' } = {}) {
  let score = 0;

  const candTitle = (candidate.primaryTitle || '').toLowerCase();
  const wantTitle = (title || '').toLowerCase();
  const titleEqual = candTitle === wantTitle;
  const titleContains = candTitle.includes(wantTitle) || wantTitle.includes(candTitle);

  if (titleEqual) score += 100;
  else if (titleContains) score += 30;

  if (year && candidate.startYear) {
    const yearDiff = Math.abs(candidate.startYear - year);
    if (yearDiff === 0) score += 50;
    else if (yearDiff === 1) score += 20;
    else if (yearDiff > 2) score -= 40;
  }

  if (type === 'tv') {
    if (candidate.type === 'tvSeries') score += 30;
    else score -= 30;
  } else if (candidate.type === 'movie') {
    score += 30;
  } else {
    score -= 30;
  }

  return score;
}

/**
 * Pick the highest-scoring IMDb candidate for the given target metadata.
 * Returns null when `matches` is empty.
 *
 * @param {Array} matches
 * @param {{title?: string, year?: number|null, type?: string}} target
 * @returns {object|null}
 */
export function pickBestImdbMatch(matches, target) {
  let best = null;
  let bestScore = -1000;
  for (const candidate of matches || []) {
    const score = scoreImdbMatch(candidate, target);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}
