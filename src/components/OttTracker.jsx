import React, { useMemo, useState } from 'react';
import { Calendar, Clapperboard, CalendarDays, MapPin } from 'lucide-react';
import { rowKey } from './discover/DiscoverResults';
import TimelinePanel from './discover/TimelinePanel';
import AtHomePanel from './discover/AtHomePanel';
import WeeklyPanel from './discover/WeeklyPanel';
import SieveIndia from './SieveIndia';

const TABS = [
  { id: 'timeline', label: 'Timeline', icon: Calendar },
  { id: 'athome', label: 'At Home', icon: MapPin },
  { id: 'weekly', label: 'Weekly', icon: CalendarDays },
  { id: 'india', label: 'India', icon: Clapperboard },
];

/**
 * Unified "Discover" surface. One tab strip — Timeline · At Home · Weekly ·
 * India — over a single results convention (see discover/DiscoverResults).
 * `mediaType` ('movie' | 'tv') threads through every panel.
 *
 * Props (from App):
 *   shows              full show database
 *   watchlist          current watchlist entries
 *   onToggleWatchlist  (show) => void
 *   onImportNewShows   (shows[]) => void
 *   mediaType          'movie' | 'tv'
 */
export default function OttTracker({
  shows = [],
  watchlist = [],
  onToggleWatchlist,
  onImportNewShows,
  mediaType = 'movie',
}) {
  const [tab, setTab] = useState('timeline');

  // O(1) existence checks for every panel — one memoized Set keyed by rowKey.
  const existingKeys = useMemo(() => new Set(shows.map(rowKey)), [shows]);

  return (
    <div className="tracker-container">
      <div className="discover-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`discover-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="discover-panel">
        {tab === 'timeline' && (
          <TimelinePanel
            shows={shows}
            mediaType={mediaType}
            watchlist={watchlist}
            onToggleWatchlist={onToggleWatchlist}
          />
        )}
        {tab === 'athome' && (
          <AtHomePanel
            existingKeys={existingKeys}
            mediaType={mediaType}
            onImportNewShows={onImportNewShows}
            onToggleWatchlist={onToggleWatchlist}
            watchlist={watchlist}
          />
        )}
        {tab === 'weekly' && (
          <WeeklyPanel
            existingKeys={existingKeys}
            mediaType={mediaType}
            onImportNewShows={onImportNewShows}
            onToggleWatchlist={onToggleWatchlist}
            watchlist={watchlist}
          />
        )}
        {tab === 'india' && (
          <SieveIndia
            shows={shows}
            existingKeys={existingKeys}
            mediaType={mediaType}
            onImportNewShows={onImportNewShows}
            onToggleWatchlist={onToggleWatchlist}
            watchlist={watchlist}
          />
        )}
      </div>
    </div>
  );
}
