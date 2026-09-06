import React, { useMemo, useState } from 'react';
import { Calendar, Film, Tv, Bookmark, ExternalLink, Play, Search } from 'lucide-react';
import { formatSieveScore } from '../../utils/score';

const todayStr = new Date().toISOString().slice(0, 10);

/**
 * Timeline source: dated titles already in the database, grouped by release date.
 */
export default function TimelinePanel({
  shows = [],
  mediaType = 'movie',
  watchlist = [],
  onToggleWatchlist,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const datedShows = useMemo(() => {
    return shows
      .filter((s) => s.releaseDate && (s.type || 'movie') === mediaType)
      .filter((s) => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  }, [shows, searchTerm, mediaType]);

  const groupedShows = useMemo(() => {
    const groups = {};
    datedShows.forEach((show) => {
      (groups[show.releaseDate] ||= []).push(show);
    });
    return groups;
  }, [datedShows]);

  const isWatchlisted = (showId) => watchlist.some((item) => item.id === showId);

  const formatDateLabel = (dateStr) => {
    const formatted = new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (dateStr === todayStr) {
      return (
        <>
          {formatted} <span className="today-badge">Today&apos;s Release</span>
        </>
      );
    }
    if (new Date(dateStr) > new Date(todayStr)) {
      return (
        <>
          {formatted}{' '}
          <span className="today-badge" style={{ backgroundColor: 'var(--accent-primary)' }}>
            Upcoming
          </span>
        </>
      );
    }
    return formatted;
  };

  return (
    <div>
      <div className="discover-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder={`Search ${mediaType === 'tv' ? 'TV releases' : 'movie releases'}…`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="tracker-timeline">
        {Object.keys(groupedShows).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>No Releases Listed</h3>
            <p>
              No dated {mediaType === 'tv' ? 'series' : 'movies'} in your database match this search.
            </p>
          </div>
        ) : (
          Object.entries(groupedShows).map(([dateStr, showsInDate]) => (
            <section className="timeline-section" key={dateStr}>
              <h3 className="timeline-date-header">
                <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
                {formatDateLabel(dateStr)}
              </h3>

              <div className="tracker-grid">
                {showsInDate.map((show) => {
                  const watchlisted = isWatchlisted(show.id);
                  return (
                    <div className="compact-show-card" key={show.id} id={`tracker-item-${show.id}`}>
                      <div className="compact-icon">
                        {(show.type || 'movie') === 'movie' ? <Film size={20} /> : <Tv size={20} />}
                      </div>

                      <div className="compact-details">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
                          <h4 className="compact-title">{show.title}</h4>
                          <span className="compact-score-badge">★ {formatSieveScore(show)}</span>
                        </div>

                        <p className="compact-meta">
                          <span>{show.language}</span> •{' '}
                          <span style={{ color: 'var(--accent-secondary)' }}>{show.platform}</span>
                        </p>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => onToggleWatchlist && onToggleWatchlist(show)}
                            title={watchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                            style={{ padding: '0.35rem 0.5rem' }}
                          >
                            <Bookmark
                              size={12}
                              fill={watchlisted ? 'currentColor' : 'none'}
                              style={{ color: watchlisted ? 'var(--success)' : 'inherit' }}
                            />
                          </button>

                          <a
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                              `review ${show.title}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Play size={10} fill="currentColor" />
                            Trailers
                          </a>

                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(
                              `${show.title} ${mediaType === 'tv' ? 'series' : 'movie'} review`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            title="Search reviews"
                          >
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
