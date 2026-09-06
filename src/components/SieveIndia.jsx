import React, { useMemo, useState } from 'react';
import { Search, Youtube, Newspaper, Users, ExternalLink } from 'lucide-react';
import { fetchDiscoverIndian, openExternalUrl } from '../utils/api';

const AGE_OPTIONS = [
  { label: 'Last 2 weeks', value: 14 },
  { label: 'Last month', value: 30 },
  { label: 'Last 2 months', value: 60 },
  { label: 'Last 6 months', value: 180 },
];

export default function SieveIndia({ shows = [], reviewers = [], onImportNewShows }) {
  const [maxAgeDays, setMaxAgeDays] = useState(60);
  const [minReviewers, setMinReviewers] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [films, setFilms] = useState([]);
  const [selection, setSelection] = useState({});

  const trustedHandles = useMemo(
    () => reviewers.filter((r) => r.youtubeHandle).map((r) => r.youtubeHandle),
    [reviewers]
  );

  // Map a handle back to the display name the user configured.
  const reviewerName = useMemo(() => {
    const map = {};
    reviewers.forEach((r) => {
      if (r.youtubeHandle) map[r.youtubeHandle] = r.name;
    });
    return map;
  }, [reviewers]);

  const existingKeys = useMemo(
    () => new Set(shows.map((s) => (s.title || '').toLowerCase().replace(/[^a-z0-9]/g, ''))),
    [shows]
  );

  const visibleFilms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return films;
    return films.filter((f) => f.film.toLowerCase().includes(term));
  }, [films, searchTerm]);

  const handleDiscover = async () => {
    setIsLoading(true);
    setError('');
    setFilms([]);
    try {
      const data = await fetchDiscoverIndian({
        handles: trustedHandles,
        maxAgeDays,
        minReviewers,
      });
      if (data.error) {
        setError(data.error);
        return;
      }
      const rows = data.films || [];
      setFilms(rows);
      setMeta({
        count: data.count,
        youtubeReviewCount: data.youtubeReviewCount,
        criticReviewCount: data.criticReviewCount,
        failedReviewers: data.failedReviewers || [],
      });
      const preset = {};
      rows.forEach((f) => {
        const key = f.filmKey;
        preset[key] = f.reviewerCount >= 2 && !existingKeys.has(key);
      });
      setSelection(preset);
    } catch (err) {
      setError(`Discovery failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    const toImport = visibleFilms
      .filter((f) => selection[f.filmKey] && !existingKeys.has(f.filmKey))
      .map((f) => ({
        title: f.film,
        type: 'movie',
        language: f.language || '',
        year: f.year,
        genres: f.genres || [],
        overview: f.overview || '',
        platform: f.platform || 'Other',
        posterUrl: f.posterUrl || null,
        imdbId: f.imdbId || null,
        ratings: {
          imdb: f.imdbRating ?? null,
          rottenTomatoes: null,
          letterboxd: f.letterboxdRating ?? null,
        },
      }));
    if (toImport.length > 0 && onImportNewShows) {
      onImportNewShows(toImport);
    }
    setFilms([]);
    setMeta(null);
  };

  const selectedCount = visibleFilms.filter(
    (f) => selection[f.filmKey] && !existingKeys.has(f.filmKey)
  ).length;

  return (
    <div className="tracker-container">
      <div className="tracker-header">
        <h2 className="section-title">Sieve India</h2>
        <p className="section-subtitle">
          What the critics you trust have actually reviewed. Ranked by how many of
          your reviewers covered each film &mdash; not by IMDb or Letterboxd scores,
          which are shown only as context.
        </p>
      </div>

      <div className="discover-controls">
        <div className="reviewer-summary">
          <Users size={15} />
          <span>
            Tracking {trustedHandles.length} reviewer{trustedHandles.length === 1 ? '' : 's'}:{' '}
            {trustedHandles.map((h) => reviewerName[h] || h).join(', ') || 'none configured'}
          </span>
        </div>

        <label className="control-group">
          Reviewed within
          <select value={maxAgeDays} onChange={(e) => setMaxAgeDays(Number(e.target.value))}>
            {AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="control-group">
          Consensus
          <select value={minReviewers} onChange={(e) => setMinReviewers(Number(e.target.value))}>
            <option value={1}>Any reviewer</option>
            <option value={2}>2+ reviewers agree</option>
            <option value={3}>3+ reviewers agree</option>
          </select>
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={handleDiscover}
          disabled={isLoading || trustedHandles.length === 0}
        >
          {isLoading ? 'Checking reviewers…' : 'Check my reviewers'}
        </button>
      </div>

      {trustedHandles.length === 0 && (
        <div className="error-banner">
          No reviewers with a YouTube handle configured. Add one in Settings.
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {meta && (
        <div className="discover-meta">
          <span>{meta.count} films</span>
          <span>{meta.youtubeReviewCount} YouTube reviews</span>
          <span>{meta.criticReviewCount} press reviews</span>
          {meta.failedReviewers.length > 0 && (
            <span className="warn">⚠ unreachable: {meta.failedReviewers.join(', ')}</span>
          )}
        </div>
      )}

      {films.length > 0 && (
        <>
          <div className="discover-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Filter films…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleImport}
              disabled={selectedCount === 0}
            >
              Import {selectedCount}
            </button>
          </div>

          <div className="discover-grid">
            {visibleFilms.map((f) => {
              const already = existingKeys.has(f.filmKey);
              return (
                <div key={f.filmKey} className={`discover-row ${already ? 'is-existing' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!selection[f.filmKey] && !already}
                    disabled={already}
                    onChange={() =>
                      setSelection((prev) => ({ ...prev, [f.filmKey]: !prev[f.filmKey] }))
                    }
                  />
                  {f.posterUrl && (
                    <img className="discover-poster" src={f.posterUrl} alt={f.film} loading="lazy" />
                  )}
                  <div className="discover-info">
                    <div className="discover-title">
                      <span>{f.film}</span>
                      {f.year && <span className="muted">({f.year})</span>}
                      {already && <span className="badge">In database</span>}
                    </div>

                    {/* The headline signal: who reviewed it. */}
                    <div className="consensus-badge" data-strength={Math.min(f.reviewerCount, 3)}>
                      <Users size={13} />
                      {f.reviewerCount} trusted reviewer{f.reviewerCount === 1 ? '' : 's'}
                    </div>

                    <div className="reviewer-links">
                      {f.reviewers.map((r) => (
                        <button
                          key={r.handle}
                          type="button"
                          className="reviewer-chip"
                          onClick={() => openExternalUrl(r.reviews[0].url)}
                          title={r.reviews[0].videoTitle}
                        >
                          <Youtube size={12} />
                          {reviewerName[r.handle] || r.handle}
                        </button>
                      ))}
                      {(f.criticReviews || []).map((c) => (
                        <button
                          key={c.url}
                          type="button"
                          className="reviewer-chip is-press"
                          onClick={() => openExternalUrl(c.url)}
                          title={c.headline}
                        >
                          <Newspaper size={12} />
                          {c.reviewer}
                          {c.stars ? ` ${c.stars}/5` : ''}
                        </button>
                      ))}
                    </div>

                    {/* Context only -- deliberately de-emphasised. */}
                    <div className="context-ratings">
                      <span>IMDb {f.imdbRating ?? '—'}</span>
                      <span>Letterboxd {f.letterboxdRating ? `${f.letterboxdRating}/5` : '—'}</span>
                      {f.platform && f.platform !== 'Other' && (
                        <span className="tag-platform">{f.platform}</span>
                      )}
                    </div>

                    {f.overview && <p className="discover-overview">{f.overview}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
