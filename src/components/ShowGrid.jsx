import React from 'react';
import ShowCard from './ShowCard';

/**
 * Shared results grid for the Recommendations and Sieved Out tabs: renders the
 * ShowCard grid, or an empty state with a "reset filters" button.
 */
export default function ShowGrid({
  shows,
  watchlistIds,
  onToggleWatchlist,
  onDeleteShow,
  onRefreshShowRatings,
  reviewers,
  minSieveScore,
  includeUnrated,
  emptyIcon,
  emptyTitle,
  emptyText,
  onClearFilters,
}) {
  if (shows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">{emptyIcon}</div>
        <h3>{emptyTitle}</h3>
        <p>{emptyText}</p>
        <button className="btn btn-primary" onClick={onClearFilters} style={{ marginTop: '1.25rem' }}>
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="shows-grid">
      {shows.map(show => (
        <ShowCard
          key={show.id}
          show={show}
          isInWatchlist={watchlistIds.has(show.id)}
          onToggleWatchlist={onToggleWatchlist}
          onDeleteShow={onDeleteShow}
          onRefreshShowRatings={onRefreshShowRatings}
          reviewers={reviewers}
          minSieveScore={minSieveScore}
          includeUnrated={includeUnrated}
        />
      ))}
    </div>
  );
}
