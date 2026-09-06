import { describe, it, expect } from 'vitest';
import { calculateSieveScore, isUnrated, formatSieveScore } from './score.js';

describe('calculateSieveScore', () => {
  it('averages the three movie pillars on a 0–5 scale', () => {
    const show = { type: 'movie', ratings: { imdb: 8, rottenTomatoesAudience: 90, letterboxd: 4 } };
    // 4 + 4.5 + 4 = 12.5 / 3
    expect(calculateSieveScore(show)).toBeCloseTo(4.1667, 3);
  });

  it('falls back to RT critics for TV with no Letterboxd score', () => {
    const show = { type: 'tv', ratings: { imdb: 8, rottenTomatoesAudience: 80, rottenTomatoes: 100 } };
    // 4 + 4 + 5 = 13 / 3
    expect(calculateSieveScore(show)).toBeCloseTo(4.3333, 3);
  });

  it('does not use RT critics for movies', () => {
    const show = { type: 'movie', ratings: { imdb: 8, rottenTomatoes: 100 } };
    expect(calculateSieveScore(show)).toBe(4); // imdb only
  });

  it('returns 0 when nothing is rated', () => {
    expect(calculateSieveScore({ type: 'movie', ratings: {} })).toBe(0);
  });

  it('treats undefined and null identically', () => {
    const a = calculateSieveScore({ ratings: { imdb: 8, letterboxd: null } });
    const b = calculateSieveScore({ ratings: { imdb: 8 } });
    expect(a).toBe(b);
  });
});

describe('isUnrated', () => {
  it('is true only when every pillar is missing', () => {
    expect(isUnrated({ ratings: {} })).toBe(true);
    expect(isUnrated({ ratings: { imdb: 0 } })).toBe(false);
    expect(isUnrated({ ratings: { letterboxd: 3 } })).toBe(false);
  });
});

describe('formatSieveScore', () => {
  it('is N/A for unrated shows', () => {
    expect(formatSieveScore({ ratings: {} })).toBe('N/A');
  });
  it('is a 2dp string otherwise', () => {
    expect(formatSieveScore({ type: 'movie', ratings: { imdb: 8 } })).toBe('4.00');
  });
});
