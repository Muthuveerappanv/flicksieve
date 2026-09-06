import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDiscoverIndian } from './api.js';

// fetchDiscoverIndian hits the dev-server proxy (/api/discover-indian) whenever
// it is not running inside Tauri, which is the case under vitest. Stub fetch and
// assert on the URL it builds so a regression in the query-string contract fails
// here rather than silently at runtime.
function stubFetch() {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ films: [], count: 0 }),
  });
  global.fetch = spy;
  return spy;
}

function queryOf(spy) {
  const url = new URL(spy.mock.calls[0][0], 'http://localhost');
  return url.searchParams;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchDiscoverIndian query params', () => {
  it('defaults to a 3 month window', async () => {
    const spy = stubFetch();
    await fetchDiscoverIndian();
    expect(queryOf(spy).get('window_days')).toBe('90');
  });

  it('supports the 6 month window', async () => {
    const spy = stubFetch();
    await fetchDiscoverIndian({ windowDays: 180 });
    expect(queryOf(spy).get('window_days')).toBe('180');
  });

  it('comma-joins languages', async () => {
    const spy = stubFetch();
    await fetchDiscoverIndian({ languages: ['Telugu', 'Hindi'] });
    expect(queryOf(spy).get('languages')).toBe('Telugu,Hindi');
  });

  it('passes the minimum rating through', async () => {
    const spy = stubFetch();
    await fetchDiscoverIndian({ minRating: 3.5 });
    expect(queryOf(spy).get('min_rating')).toBe('3.5');
  });

  it('omits the minimum rating when null', async () => {
    const spy = stubFetch();
    await fetchDiscoverIndian({ minRating: null });
    expect(queryOf(spy).get('min_rating')).toBe('');
  });

  it('keeps YouTube off by default', async () => {
    const spy = stubFetch();
    await fetchDiscoverIndian();
    expect(queryOf(spy).get('include_youtube')).toBe('false');
  });

  it('throws on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchDiscoverIndian()).rejects.toThrow(/500/);
  });
});
