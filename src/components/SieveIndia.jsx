import React, { useMemo, useState } from 'react';
import { MonitorPlay, Newspaper } from 'lucide-react';
import { fetchDiscoverIndian, openExternalUrl } from '../utils/api';
import { useToast } from '../context/ToastContext';
import DiscoverResults, { rowKey } from './discover/DiscoverResults';

const WINDOW_OPTIONS = [
  { label: 'Last 3 months', value: 90 },
  { label: 'Last 6 months', value: 180 },
];

const ALL_LANGUAGES = ['Tamil', 'Telugu', 'Malayalam', 'Hindi'];

/**
 * India source panel: critic-first discovery of Indian-language films.
 *
 * NOTE: the "Also check my YouTube reviewers" checkbox toggles a backend
 * supplement — the discover-indian service uses its own curated reviewer list,
 * not the app's `reviewers` collection.
 */
export default function SieveIndia({
  shows = [],
  mediaType = 'movie',
  onImportNewShows,
  onToggleWatchlist,
  watchlist = [],
  existingKeys: existingKeysProp,
}) {
  const { triggerToast } = useToast();

  const [windowDays, setWindowDays] = useState(90);
  const [selectedLanguages, setSelectedLanguages] = useState([...ALL_LANGUAGES]);
  const [minRating, setMinRating] = useState(0);
  const [includeYoutube, setIncludeYoutube] = useState(false);
  const [sortBy, setSortBy] = useState('score');

  const [isLoading, setIsLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [films, setFilms] = useState([]);

  const existingKeys = useMemo(
    () => existingKeysProp instanceof Set ? existingKeysProp : new Set(shows.map(rowKey)),
    [existingKeysProp, shows]
  );

  const sortedFilms = useMemo(() => {
    const sorters = {
      score: (a, b) => b.score - a.score,
      rating: (a, b) => (b.avgStars ?? -1) - (a.avgStars ?? -1),
      critics: (a, b) => b.criticCount - a.criticCount,
      newest: (a, b) => (a.ageDays ?? 9999) - (b.ageDays ?? 9999),
    };
    return [...films].sort(sorters[sortBy] || sorters.score);
  }, [films, sortBy]);

  const handleDiscover = async () => {
    setIsLoading(true);
    setFilms([]);
    try {
      const data = await fetchDiscoverIndian({
        windowDays,
        languages: selectedLanguages,
        minRating: minRating > 0 ? minRating : null,
        includeYoutube,
      });
      if (data.error) {
        triggerToast(data.error, 'error');
        return;
      }
      setFilms(data.films || []);
      setMeta({
        count: data.count,
        criticReviewCount: data.criticReviewCount,
        youtubeReviewCount: data.youtubeReviewCount,
        outletsUsed: data.outletsUsed || [],
        failedOutlets: data.failedOutlets || [],
        failedReviewers: data.failedReviewers || [],
      });
    } catch (err) {
      triggerToast(`Discovery failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toShow = (f) => ({
    title: f.film,
    type: mediaType,
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
  });

  const handleImport = (selected) => {
    if (selected.length && onImportNewShows) onImportNewShows(selected.map(toShow));
    setFilms([]);
    setMeta(null);
  };

  const watchlistKeys = new Set(watchlist.map(rowKey));

  return (
    <div>
      <p className="section-subtitle">
        Handpicked, credible Indian critic reviews for Tamil, Telugu, Malayalam, and Hindi films.
        Ranked by professional critic verdicts &mdash; IMDb and Letterboxd scores are shown only as
        context.
      </p>

      <div className="discover-controls">
        <label className="control-group">
          Window
          <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
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
                  onClick={() =>
                    setSelectedLanguages((prev) =>
                      active ? prev.filter((l) => l !== lang) : [...prev, lang]
                    )
                  }
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

        <button type="button" className="btn btn-primary" onClick={handleDiscover} disabled={isLoading}>
          {isLoading ? 'Checking reviews…' : 'Discover films'}
        </button>
      </div>

      {meta && (
        <div className="discover-meta">
          <span>{meta.count} films</span>
          <span>{meta.criticReviewCount} press reviews</span>
          {meta.youtubeReviewCount > 0 && <span>{meta.youtubeReviewCount} YouTube reviews</span>}
          {meta.failedOutlets?.length > 0 && (
            <span className="warn">⚠ unreachable outlets: {meta.failedOutlets.join(', ')}</span>
          )}
          {meta.failedReviewers?.length > 0 && (
            <span className="warn">⚠ unreachable reviewers: {meta.failedReviewers.join(', ')}</span>
          )}
        </div>
      )}

      <DiscoverResults
        rows={sortedFilms}
        existingKeys={existingKeys}
        onImport={handleImport}
        importLabel="Import"
        searchPlaceholder="Filter films…"
        getText={(f) => f.film || ''}
        emptyText="No films match your filter."
        onWatchlist={
          onToggleWatchlist ? (f) => onToggleWatchlist({ ...toShow(f), id: rowKey(f) }) : undefined
        }
        isWatchlisted={(f) => watchlistKeys.has(rowKey(f))}
        renderRow={(f) => (
          <>
            {f.posterUrl && (
              <img className="discover-poster" src={f.posterUrl} alt={f.film} loading="lazy" />
            )}
            <div className="discover-info">
              <div className="discover-title">
                <span>{f.film}</span>
                {f.year && <span className="muted">({f.year})</span>}
              </div>

              <div className="verdict-row">
                <span className="verdict-stars">{f.avgStars ? `★ ${f.avgStars}/5` : '★ —'}</span>
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
                    {c.outlet}
                    {c.stars ? ` ★${c.stars}` : ''}
                  </button>
                ))}
                {(f.youtubeReviews || []).map((y) => (
                  <button
                    key={y.url}
                    type="button"
                    className="reviewer-chip"
                    onClick={() => openExternalUrl(y.url)}
                  >
                    <MonitorPlay size={12} />
                    {y.reviewer}
                  </button>
                ))}
              </div>

              <div className="context-ratings">
                <span>IMDb {f.imdbRating ?? '—'}</span>
                <span>Letterboxd {f.letterboxdRating ? `${f.letterboxdRating}/5` : '—'}</span>
                {f.platform && f.platform !== 'Other' && (
                  <span className="tag-platform">{f.platform}</span>
                )}
              </div>

              {f.overview && <p className="discover-overview">{f.overview}</p>}
            </div>
          </>
        )}
      />
    </div>
  );
}
