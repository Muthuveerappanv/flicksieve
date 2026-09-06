import React, { useMemo, useState } from 'react';
import { fetch91Mobiles } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import DiscoverResults, { rowKey } from './DiscoverResults';

const PREFERRED_LANGUAGES = ['tamil', 'malayalam', 'hindi', 'english'];
const NON_PREFERRED_GENRES = [
  'documentary',
  'reality',
  'reality-tv',
  'animation',
  'talk-show',
  'news',
  'game-show',
];

/**
 * "Weekly" source: the 91mobiles OTT release scrape, enriched with IMDb ids.
 */
export default function WeeklyPanel({
  existingKeys,
  mediaType = 'movie',
  onImportNewShows,
  onToggleWatchlist,
  watchlist = [],
}) {
  const { triggerToast } = useToast();
  const noun = mediaType === 'tv' ? 'TV releases' : 'movie releases';

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [scraped, setScraped] = useState([]);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [showNonPreferredGenres, setShowNonPreferredGenres] = useState(false);

  const visibleRows = useMemo(() => {
    return scraped.filter((show) => {
      if (mediaType === 'tv' ? show.type !== 'tv' : show.type === 'tv') return false;
      const lang = (show.language || '').toLowerCase();
      if (!showAllLanguages && !PREFERRED_LANGUAGES.includes(lang)) return false;
      const genres = (show.genres || []).map((g) => g.toLowerCase());
      if (!showNonPreferredGenres && genres.some((g) => NON_PREFERRED_GENRES.includes(g))) {
        return false;
      }
      return true;
    });
  }, [scraped, showAllLanguages, showNonPreferredGenres, mediaType]);

  const handleScan = async () => {
    setIsScanning(true);
    setProgress('Connecting…');
    setScraped([]);
    try {
      const data = await fetch91Mobiles((current, total, title) => {
        setProgress(total === 0 ? title : `Resolving (${current}/${total}): ${title}`);
      });
      if (data.shows && data.shows.length > 0) {
        setScraped(data.shows);
        setShowAllLanguages(false);
        setShowNonPreferredGenres(false);
      } else if (data.error) {
        triggerToast(`Scan error: ${data.error}`, 'error');
      } else {
        triggerToast('No releases found for this week.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast(
        `Error scanning weekly releases: ${err.message}. Make sure the Python virtual environment is set up.`,
        'error'
      );
    } finally {
      setIsScanning(false);
      setProgress('');
    }
  };

  const handleImport = (selected) => {
    if (selected.length && onImportNewShows) onImportNewShows(selected);
    setScraped([]);
  };

  const watchlistKeys = new Set(watchlist.map(rowKey));

  return (
    <div>
      <div className="discover-controls">
        <button type="button" className="btn btn-primary" onClick={handleScan} disabled={isScanning}>
          {isScanning ? progress || 'Scanning…' : `Scan weekly ${noun} ⚡`}
        </button>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={showAllLanguages}
            onChange={(e) => setShowAllLanguages(e.target.checked)}
          />
          <span>Show all languages</span>
        </label>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={showNonPreferredGenres}
            onChange={(e) => setShowNonPreferredGenres(e.target.checked)}
          />
          <span>Show non-preferred genres (reality, documentary, animation)</span>
        </label>
      </div>

      <DiscoverResults
        rows={visibleRows}
        existingKeys={existingKeys}
        onImport={handleImport}
        importLabel="Import"
        searchPlaceholder={`Filter ${noun}…`}
        emptyText="No releases match the current language / genre preferences."
        onWatchlist={
          onToggleWatchlist
            ? (s) => onToggleWatchlist({ ...s, id: rowKey(s) })
            : undefined
        }
        isWatchlisted={(s) => watchlistKeys.has(rowKey(s))}
        renderRow={(show) => {
          const imdb = show.ratings?.imdb ?? null;
          let ratingClass = 'rating-low';
          if (imdb >= 7.5) ratingClass = 'rating-high';
          else if (imdb >= 6.0) ratingClass = 'rating-mid';
          return (
            <>
              {show.posterUrl ? (
                <img className="discover-poster" src={show.posterUrl} alt={show.title} loading="lazy" />
              ) : null}
              <div className="discover-info">
                <div className="discover-title">
                  <span>{show.title}</span>
                  {show.year && <span className="muted">({show.year})</span>}
                </div>
                <div className="verdict-row">
                  {imdb != null ? (
                    <span className={`scrape-show-rating ${ratingClass}`}>★ {imdb.toFixed(1)}</span>
                  ) : (
                    <span className="scrape-show-rating">Rating NA</span>
                  )}
                  <span className="tag-language">{show.language || '—'}</span>
                  <span className="tag-platform">{show.platform || '—'}</span>
                  <span className="muted">{show.releaseDate || 'Date TBD'}</span>
                </div>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
