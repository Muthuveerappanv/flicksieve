import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fetchDiscoverAtHome } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import DiscoverResults, { rowKey } from './DiscoverResults';

const WINDOW_OPTIONS = [
  { label: '3 months', value: 90 },
  { label: '6 months', value: 180 },
  { label: '12 months', value: 365 },
];
const AUDIENCE_OPTIONS = [60, 70, 80, 90];

/**
 * "At Home" source: Rotten Tomatoes titles that recently started streaming with
 * a strong audience score. Controls live above the results, not in a modal, so
 * the first run honours the chosen window / audience / sort.
 */
export default function AtHomePanel({
  existingKeys,
  mediaType = 'movie',
  onImportNewShows,
  onToggleWatchlist,
  watchlist = [],
}) {
  const { triggerToast } = useToast();
  const noun = mediaType === 'tv' ? 'TV series' : 'movies';

  const [days, setDays] = useState(90);
  const [minAudience, setMinAudience] = useState(70);
  const [sort, setSort] = useState('audience'); // 'audience' | 'date'
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    if (sort === 'date') {
      list.sort(
        (a, b) =>
          (b.streamingDate || '').localeCompare(a.streamingDate || '') ||
          (b.audienceScore ?? -1) - (a.audienceScore ?? -1)
      );
    } else {
      list.sort(
        (a, b) =>
          (b.audienceScore ?? -1) - (a.audienceScore ?? -1) ||
          (b.criticScore ?? -1) - (a.criticScore ?? -1) ||
          (b.streamingDate || '').localeCompare(a.streamingDate || '')
      );
    }
    return list;
  }, [rows, sort]);

  const handleDiscover = async () => {
    setIsLoading(true);
    setRows([]);
    try {
      const data = await fetchDiscoverAtHome(days, minAudience, sort, mediaType);
      if (data.error) {
        triggerToast(`Discovery error: ${data.error}`, 'error');
        return;
      }
      const items = data.shows || data.movies || [];
      setRows(items);
      setMeta({
        windowDays: data.windowDays,
        minAudience: data.minAudience,
        failedPages: data.failedPages || 0,
        count: data.count ?? items.length,
      });
      if (items.length === 0) {
        triggerToast(
          `No new at-home ${noun} matched. Try a wider window or a lower audience threshold.`,
          'error'
        );
      }
    } catch (err) {
      console.error(err);
      triggerToast(
        `Error discovering at-home ${noun}. Make sure the Python virtual environment is set up.`,
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toShow = (m) => ({
    title: m.title,
    type: mediaType,
    // Leave descriptive metadata empty — App's background resolver fills it in.
    language: '',
    genres: [],
    platform: '',
    year: m.year ?? null,
    releaseDate: m.streamingDate || null,
    overview: '',
    posterUrl: m.posterUrl || null,
    imdbId: m.imdbId || null,
    rottenTomatoesUrl: m.url || null,
    ratings: {
      imdb: null,
      rottenTomatoes: m.criticScore ?? null,
      letterboxd: null,
      rottenTomatoesAudience: m.audienceScore ?? null,
    },
  });

  const handleImport = (selected) => {
    if (selected.length && onImportNewShows) onImportNewShows(selected.map(toShow));
    setRows([]);
  };

  const watchlistKeys = new Set(watchlist.map(rowKey));

  return (
    <div>
      <div className="discover-controls">
        <label className="control-group">
          Window
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="control-group">
          Audience &ge;
          <select value={minAudience} onChange={(e) => setMinAudience(Number(e.target.value))}>
            {AUDIENCE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
        </label>

        <label className="control-group">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="audience">Audience score</option>
            <option value="date">Streaming date</option>
          </select>
        </label>

        <button type="button" className="btn btn-primary" onClick={handleDiscover} disabled={isLoading}>
          {isLoading ? 'Discovering…' : `Discover at-home ${noun} 🍅`}
        </button>
      </div>

      {meta && (
        <div className="discover-meta">
          <span>{meta.count} {noun}</span>
          {meta.failedPages > 0 && (
            <span className="warn">
              ⚠ {meta.failedPages} page(s) failed to load (Rotten Tomatoes rate-limited). Results may
              be incomplete — try again in a minute.
            </span>
          )}
        </div>
      )}

      <DiscoverResults
        rows={sortedRows}
        existingKeys={existingKeys}
        onImport={handleImport}
        importLabel="Import"
        searchPlaceholder={`Filter ${noun}…`}
        emptyText={`No at-home ${noun} match your filter.`}
        onWatchlist={onToggleWatchlist ? (m) => onToggleWatchlist({ ...toShow(m), id: rowKey(m) }) : undefined}
        isWatchlisted={(m) => watchlistKeys.has(rowKey(m))}
        renderRow={(m) => {
          let ratingClass = 'rating-low';
          if ((m.audienceScore ?? 0) >= 85) ratingClass = 'rating-high';
          else if ((m.audienceScore ?? 0) >= 70) ratingClass = 'rating-mid';
          return (
            <>
              {m.posterUrl ? (
                <img className="discover-poster" src={m.posterUrl} alt={m.title} loading="lazy" />
              ) : null}
              <div className="discover-info">
                <div className="discover-title">
                  <span>{m.title}</span>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="muted"
                      title="Open on Rotten Tomatoes"
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <div className="verdict-row">
                  <span className={`scrape-show-rating ${ratingClass}`}>
                    🍅 {m.audienceScore != null ? `${m.audienceScore}%` : 'NA'}
                  </span>
                  <span className="verdict-count">
                    Critics {m.criticScore != null ? `${m.criticScore}%` : 'NA'}
                  </span>
                  {m.streamingDate && <span className="muted">Streaming {m.streamingDate}</span>}
                </div>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
