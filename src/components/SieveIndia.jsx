import React, { useMemo, useState } from 'react';
import { Search, Youtube, Newspaper } from 'lucide-react';
import { fetchDiscoverIndian, openExternalUrl } from '../utils/api';

const WINDOW_OPTIONS = [
  { label: 'Last 3 months', value: 90 },
  { label: 'Last 6 months', value: 180 },
];

const ALL_LANGUAGES = ['Tamil', 'Telugu', 'Malayalam', 'Hindi'];

export default function SieveIndia({ shows = [], reviewers = [], onImportNewShows }) {
  const [windowDays, setWindowDays] = useState(90);
  const [selectedLanguages, setSelectedLanguages] = useState(['Tamil', 'Telugu', 'Malayalam', 'Hindi']);
  const [minRating, setMinRating] = useState(0);
  const [includeYoutube, setIncludeYoutube] = useState(false);
  const [sortBy, setSortBy] = useState('score');
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [films, setFilms] = useState([]);
  const [selection, setSelection] = useState({});

  const existingKeys = useMemo(
    () => new Set(shows.map((s) => (s.title || '').toLowerCase().replace(/[^a-z0-9]/g, ''))),
    [shows]
  );

  const visibleFilms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let rows = films.filter((f) => !term || f.film.toLowerCase().includes(term));
    const sorters = {
      score: (a, b) => b.score - a.score,
      rating: (a, b) => (b.avgStars ?? -1) - (a.avgStars ?? -1),
      critics: (a, b) => b.criticCount - a.criticCount,
      newest: (a, b) => (a.ageDays ?? 9999) - (b.ageDays ?? 9999),
    };
    return [...rows].sort(sorters[sortBy] || sorters.score);
  }, [films, searchTerm, sortBy]);

  const handleDiscover = async () => {
    setIsLoading(true);
    setError('');
    setFilms([]);
    try {
      const data = await fetchDiscoverIndian({
        windowDays,
        languages: selectedLanguages,
        minRating: minRating > 0 ? minRating : null,
        includeYoutube,
      });
      if (data.error) {
        setError(data.error);
        return;
      }
      const rows = data.films || [];
      setFilms(rows);
      setMeta({
        count: data.count,
        criticReviewCount: data.criticReviewCount,
        youtubeReviewCount: data.youtubeReviewCount,
        outletsUsed: data.outletsUsed || [],
        failedOutlets: data.failedOutlets || [],
        failedReviewers: data.failedReviewers || [],
      });
      const preset = {};
      rows.forEach((f) => {
        const key = f.filmKey;
        preset[key] = !existingKeys.has(key);
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
          Handpicked, credible Indian critic reviews for Tamil, Telugu, Malayalam, and Hindi films.
          Ranked by professional critic verdicts &mdash; IMDb and Letterboxd scores are shown only as context.
        </p>
      </div>

      <div className="discover-controls">
        <label className="control-group">
          Window
          <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <div className="control-group">
          <span>Languages</span>
          <div className="language-chips">
            {ALL_LANGUAGES.map((lang) => {
              const active = selectedLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  className={`reviewer-chip ${active ? 'active' : ''}`}
                  style={{
                    borderColor: active ? 'var(--accent-primary, #a855f7)' : undefined,
                    background: active ? 'rgba(168, 85, 247, 0.2)' : undefined,
                  }}
                  onClick={() => {
                    setSelectedLanguages((prev) =>
                      active ? prev.filter((l) => l !== lang) : [...prev, lang]
                    );
                  }}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>

        <label className="rating-slider">
          <span>Min rating: {minRating === 0 ? 'Any' : `★ ${minRating}`}</span>
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
          />
        </label>

        <label className="control-group">
          Sort
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score">Best reviewed</option>
            <option value="rating">Highest rated</option>
            <option value="critics">Most reviewed</option>
            <option value="newest">Newest</option>
          </select>
        </label>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={includeYoutube}
            onChange={(e) => setIncludeYoutube(e.target.checked)}
          />
          <span>Also check my YouTube reviewers</span>
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={handleDiscover}
          disabled={isLoading}
        >
          {isLoading ? 'Checking reviews…' : 'Discover films'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {meta && (
        <div className="discover-meta">
          <span>{meta.count} films</span>
          <span>{meta.criticReviewCount} press reviews</span>
          {meta.youtubeReviewCount > 0 && (
            <span>{meta.youtubeReviewCount} YouTube reviews</span>
          )}
          {meta.failedOutlets?.length > 0 && (
            <span className="warn">⚠ unreachable outlets: {meta.failedOutlets.join(', ')}</span>
          )}
          {meta.failedReviewers?.length > 0 && (
            <span className="warn">⚠ unreachable reviewers: {meta.failedReviewers.join(', ')}</span>
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

                    <div className="verdict-row">
                      <span className="verdict-stars">
                        {f.avgStars ? `★ ${f.avgStars}/5` : '★ —'}
                      </span>
                      <span className="verdict-count">
                        {f.criticCount} critic{f.criticCount === 1 ? '' : 's'}
                      </span>
                      {f.language && <span className="tag-language">{f.language}</span>}
                    </div>

                    <div className="reviewer-links">
                      {(f.criticReviews || []).map((c) => (
                        <button
                          key={c.url}
                          type="button"
                          className="reviewer-chip is-press"
                          onClick={() => openExternalUrl(c.url)}
                          title={c.headline}
                        >
                          <Newspaper size={12} />
                          {c.outlet}{c.stars ? ` ★${c.stars}` : ''}
                        </button>
                      ))}
                      {(f.youtubeReviews || []).map((y) => (
                        <button
                          key={y.url}
                          type="button"
                          className="reviewer-chip"
                          onClick={() => openExternalUrl(y.url)}
                        >
                          <Youtube size={12} />
                          {y.reviewer}
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
