import test from 'node:test';
import assert from 'node:assert/strict';

// The query-string contract the Vite route depends on.
function buildParams({ handles = [], maxAgeDays = 60, minReviewers = 1 } = {}) {
  const handleParam = Array.isArray(handles) ? handles.join(',') : String(handles || '');
  return new URLSearchParams({
    handles: handleParam,
    max_age_days: String(maxAgeDays),
    min_reviewers: String(minReviewers),
  }).toString();
}

test('empty handles defers to reviewers.json on the backend', () => {
  assert.match(buildParams(), /handles=&/);
});

test('explicit handles are comma-joined', () => {
  assert.match(
    buildParams({ handles: ['@TamilTalkies', '@Filmicraft'] }),
    /handles=%40TamilTalkies%2C%40Filmicraft/
  );
});

test('numeric options are serialised as strings', () => {
  const qs = buildParams({ maxAgeDays: 30, minReviewers: 2 });
  assert.match(qs, /max_age_days=30/);
  assert.match(qs, /min_reviewers=2/);
});
