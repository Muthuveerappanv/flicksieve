import { describe, it, expect } from 'vitest';
import { scoreImdbMatch, pickBestImdbMatch } from './imdbMatch.js';

describe('scoreImdbMatch', () => {
  it('rewards an exact title, same year and matching movie type', () => {
    const score = scoreImdbMatch(
      { primaryTitle: 'Dune', startYear: 2021, type: 'movie' },
      { title: 'Dune', year: 2021, type: 'movie' }
    );
    expect(score).toBe(100 + 50 + 30);
  });

  it('rewards a partial title match less than an exact one', () => {
    const score = scoreImdbMatch(
      { primaryTitle: 'Dune: Part Two', startYear: 2024, type: 'movie' },
      { title: 'Dune', year: 2024, type: 'movie' }
    );
    expect(score).toBe(30 + 50 + 30);
  });

  it('gives +20 for a one-year gap and -40 for a wide gap', () => {
    expect(
      scoreImdbMatch(
        { primaryTitle: 'X', startYear: 2020, type: 'movie' },
        { title: 'X', year: 2021, type: 'movie' }
      )
    ).toBe(100 + 20 + 30);
    expect(
      scoreImdbMatch(
        { primaryTitle: 'X', startYear: 2010, type: 'movie' },
        { title: 'X', year: 2021, type: 'movie' }
      )
    ).toBe(100 - 40 + 30);
  });

  it('penalises a type mismatch', () => {
    expect(
      scoreImdbMatch(
        { primaryTitle: 'Shogun', startYear: 2024, type: 'movie' },
        { title: 'Shogun', year: 2024, type: 'tv' }
      )
    ).toBe(100 + 50 - 30);
    expect(
      scoreImdbMatch(
        { primaryTitle: 'Shogun', startYear: 2024, type: 'tvSeries' },
        { title: 'Shogun', year: 2024, type: 'tv' }
      )
    ).toBe(100 + 50 + 30);
  });

  it('ignores the year component when either year is missing', () => {
    expect(
      scoreImdbMatch(
        { primaryTitle: 'X', startYear: null, type: 'movie' },
        { title: 'X', year: 2021, type: 'movie' }
      )
    ).toBe(100 + 30);
  });
});

describe('pickBestImdbMatch', () => {
  it('returns null for an empty candidate list', () => {
    expect(pickBestImdbMatch([], { title: 'X' })).toBeNull();
  });

  it('picks the highest-scoring candidate', () => {
    const matches = [
      { id: 'tt1', primaryTitle: 'The Batman', startYear: 2000, type: 'movie' },
      { id: 'tt2', primaryTitle: 'The Batman', startYear: 2022, type: 'movie' },
    ];
    const best = pickBestImdbMatch(matches, { title: 'The Batman', year: 2022, type: 'movie' });
    expect(best.id).toBe('tt2');
  });
});
