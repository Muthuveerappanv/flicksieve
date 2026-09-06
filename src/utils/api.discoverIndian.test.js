import test from 'node:test';
import assert from 'node:assert/strict';

function buildParams({
  windowDays = 90, languages = [], minRating = null,
  minCritics = 1, includeYoutube = false,
} = {}) {
  const langParam = Array.isArray(languages) ? languages.join(',') : String(languages || '');
  const ratingParam = minRating === null || minRating === '' ? '' : String(minRating);
  return new URLSearchParams({
    window_days: String(windowDays),
    languages: langParam,
    min_rating: ratingParam,
    min_critics: String(minCritics),
    include_youtube: String(includeYoutube),
  }).toString();
}

test('defaults to a 3 month window', () => {
  assert.match(buildParams(), /window_days=90/);
});

test('supports the 6 month window', () => {
  assert.match(buildParams({ windowDays: 180 }), /window_days=180/);
});

test('languages are comma joined', () => {
  assert.match(buildParams({ languages: ['Telugu', 'Hindi'] }), /languages=Telugu%2CHindi/);
});

test('minimum rating is passed through', () => {
  assert.match(buildParams({ minRating: 3.5 }), /min_rating=3\.5/);
});

test('youtube is off by default', () => {
  assert.match(buildParams(), /include_youtube=false/);
});
