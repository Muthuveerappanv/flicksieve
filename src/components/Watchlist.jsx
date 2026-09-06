import React, { useState } from 'react';
import { Clock, CheckCircle, Trash2, Star, MessageSquare, Calendar, X } from 'lucide-react';
import { formatSieveScore } from '../utils/score.js';

export default function Watchlist({ 
  watchlist = [], 
  onRemoveFromWatchlist,
  watchedHistory = [],
  onAddToHistory,
  onRemoveFromHistory,
  onUpdateWatchlistShow,
  mediaType = 'movie'
}) {
  const [activeTab, setActiveTab] = useState('towatch'); // 'towatch' or 'watched'
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedShowToLog, setSelectedShowToLog] = useState(null);
  
  // Rating & review form states
  const [userRating, setUserRating] = useState(5);
  const [userReview, setUserReview] = useState('');
  const [watchDate, setWatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [logScope, setLogScope] = useState('full'); // 'full' or 'season'

  // Filter lists strictly by active mediaType
  const currentWatchlist = React.useMemo(() => {
    return watchlist.filter(item => (item.type || 'movie') === mediaType);
  }, [watchlist, mediaType]);

  const currentHistory = React.useMemo(() => {
    return watchedHistory.filter(item => (item.type || 'movie') === mediaType);
  }, [watchedHistory, mediaType]);

  const handleOpenLogModal = (show) => {
    setSelectedShowToLog(show);
    setUserRating(5);
    setUserReview('');
    setWatchDate(new Date().toISOString().split('T')[0]);
    setLogScope(show.type === 'tv' ? 'season' : 'full');
    setShowLogModal(true);
  };

  const handleCloseLogModal = () => {
    setShowLogModal(false);
    setSelectedShowToLog(null);
  };

  const handleSubmitLog = (e) => {
    e.preventDefault();
    if (!selectedShowToLog) return;

    const isTv = selectedShowToLog.type === 'tv';
    const scopeLabel = isTv && logScope === 'season' 
      ? `Season ${selectedShowToLog.currentSeason || 1}` 
      : (isTv ? 'Full Series' : '');

    const logEntry = {
      ...selectedShowToLog,
      loggedRating: userRating,
      loggedReview: userReview,
      loggedDate: watchDate,
      loggedScope: scopeLabel,
      logId: `${selectedShowToLog.id}-${Date.now()}`
    };

    onAddToHistory(logEntry);
    // For movies or full series, remove from to-watch; for single season logs, keep show in watchlist
    if (!isTv || logScope === 'full') {
      onRemoveFromWatchlist(selectedShowToLog.id);
    }
    handleCloseLogModal();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Sub tabs */}
      <div className="subtabs">
        <button
          className={`subtab ${activeTab === 'towatch' ? 'active' : ''}`}
          id="btn-tab-towatch"
          onClick={() => setActiveTab('towatch')}
        >
          <Clock size={16} />
          To Watch ({currentWatchlist.length})
        </button>
        <button
          className={`subtab ${activeTab === 'watched' ? 'active' : ''}`}
          id="btn-tab-watched"
          onClick={() => setActiveTab('watched')}
        >
          <CheckCircle size={16} />
          Watched History ({currentHistory.length})
        </button>
      </div>

      {activeTab === 'towatch' ? (
        // TO WATCH GRID
        currentWatchlist.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{mediaType === 'tv' ? '📺' : '🍿'}</div>
            <h3>{mediaType === 'tv' ? 'TV Watchlist is Empty' : 'Movie Watchlist is Empty'}</h3>
            <p>Go to the Recommendations feed and hit the Watchlist button to add titles here!</p>
          </div>
        ) : (
          <div className="shows-grid">
            {currentWatchlist.map(show => (
              <div className="show-card" key={show.id} id={`watchlist-item-${show.id}`}>
                <div className={`card-poster ${show.language.toLowerCase() === 'tamil' ? 'poster-gradient-tamil' : show.language.toLowerCase() === 'malayalam' ? 'poster-gradient-malayalam' : show.language.toLowerCase() === 'english' ? 'poster-gradient-english' : show.language.toLowerCase() === 'hindi' ? 'poster-gradient-hindi' : 'poster-gradient-other'}`} style={{ height: '110px' }}>
                  <div className="card-top-tags">
                    <span className="tag-platform">{show.platform}</span>
                    <span className="tag-type">{show.type === 'movie' ? 'Movie' : 'Series'}</span>
                  </div>
                  <h3 className="card-title" style={{ zIndex: 2, fontSize: '1.25rem' }}>{show.title}</h3>
                </div>
                
                <div className="card-body" style={{ padding: '1rem', gap: '0.75rem' }}>
                  <p className="card-overview" style={{ fontSize: '0.8rem', height: '3.2rem', margin: 0 }}>
                    {show.overview}
                  </p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Language: {show.language}</span>
                    <span>Sieve Score: ★ {formatSieveScore(show)}</span>
                  </div>

                  {/* TV Progress Stepper */}
                  {show.type === 'tv' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Progress: <strong style={{ color: 'var(--accent-primary)' }}>S{show.currentSeason || 1} E{show.currentEpisode || 1}</strong>
                        {show.totalSeasons ? ` (${show.totalSeasons} seasons)` : ''}
                      </span>
                      {onUpdateWatchlistShow && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', height: 'auto' }}
                            title="Next Episode"
                            onClick={() => {
                              const nextEp = (show.currentEpisode || 1) + 1;
                              onUpdateWatchlistShow({ ...show, currentEpisode: nextEp, currentSeason: show.currentSeason || 1 });
                            }}
                          >
                            +1 Ep
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', height: 'auto' }}
                            title="Next Season"
                            onClick={() => {
                              const nextS = (show.currentSeason || 1) + 1;
                              onUpdateWatchlistShow({ ...show, currentSeason: nextS, currentEpisode: 1 });
                            }}
                          >
                            +1 Season
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      id={`btn-mark-watched-${show.id}`}
                      className="btn btn-primary"
                      onClick={() => handleOpenLogModal(show)}
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                    >
                      <CheckCircle size={14} />
                      Mark Watched
                    </button>
                    <button
                      id={`btn-remove-watch-${show.id}`}
                      className="btn btn-secondary"
                      onClick={() => onRemoveFromWatchlist(show.id)}
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                      title="Remove from watchlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // WATCHED HISTORY LIST
        currentHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{mediaType === 'tv' ? '📺' : '🎬'}</div>
            <h3>{mediaType === 'tv' ? 'No TV Watched History Yet' : 'No Movie Watched History Yet'}</h3>
            <p>Log shows you've watched from your watchlist to build your rating history!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {currentHistory.map(entry => (
              <div 
                className="channel-item" 
                key={entry.logId} 
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', padding: '1.25rem' }}
                id={`history-item-${entry.id}`}
              >
                <div
                  className={`avatar ${entry.language.toLowerCase() === 'tamil' ? 'poster-gradient-tamil' : ''}`}
                  style={{
                    borderRadius: '8px',
                    width: '50px',
                    height: '50px',
                    fontSize: '1.2rem'
                  }}
                >
                  {entry.type === 'movie' ? '🎬' : '📺'}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{entry.title}</h4>
                      {entry.loggedScope && (
                        <span className="tag-type" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                          {entry.loggedScope}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', color: 'var(--rating-gold)' }}>
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          size={14} 
                          fill={i < entry.loggedRating ? "currentColor" : "none"} 
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={12} /> Watched: {entry.loggedDate}
                    </span>
                    <span>Language: {entry.language}</span>
                  </div>

                  {entry.loggedReview && (
                    <div 
                      style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.5rem 0.75rem', 
                        backgroundColor: 'rgba(0,0,0,0.2)', 
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        borderLeft: '2px solid var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}
                    >
                      <MessageSquare size={12} style={{ marginTop: '0.2rem', flexShrink: 0 }} />
                      <span>"{entry.loggedReview}"</span>
                    </div>
                  )}
                </div>

                <button
                  id={`btn-remove-history-${entry.id}`}
                  className="btn-icon"
                  onClick={() => onRemoveFromHistory(entry.logId)}
                  title="Remove from history"
                  style={{ alignSelf: 'center', padding: '0.5rem' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* RATING & LOG MODAL */}
      {showLogModal && selectedShowToLog && (
        <div className="modal-overlay" id="log-modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Log Watched Show</h3>
              <button className="modal-close-btn" onClick={handleCloseLogModal}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitLog} className="modal-body">
              <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
                <h4 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedShowToLog.title}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedShowToLog.year} • {selectedShowToLog.language} • {selectedShowToLog.platform}
                </p>
              </div>

              {selectedShowToLog.type === 'tv' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Log Scope</label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className={`pill ${logScope === 'season' ? 'active' : ''}`}
                      onClick={() => setLogScope('season')}
                      style={{ flex: 1, textAlign: 'center' }}
                    >
                      Season {selectedShowToLog.currentSeason || 1}
                    </button>
                    <button
                      type="button"
                      className={`pill ${logScope === 'full' ? 'active' : ''}`}
                      onClick={() => setLogScope('full')}
                      style={{ flex: 1, textAlign: 'center' }}
                    >
                      Full Series
                    </button>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    {logScope === 'season' 
                      ? 'Logs this season and keeps the series in your active watchlist.' 
                      : 'Logs the complete series and marks it finished.'}
                  </span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Your Rating (1 - 5 Stars)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      id={`star-btn-${starVal}`}
                      onClick={() => setUserRating(starVal)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rating-gold)', padding: '0.25rem' }}
                    >
                      <Star 
                        size={32} 
                        fill={starVal <= userRating ? "currentColor" : "none"} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" htmlFor="log-watch-date">Watch Date</label>
                <input
                  type="date"
                  id="log-watch-date"
                  className="form-input"
                  value={watchDate}
                  onChange={(e) => setWatchDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="log-review-notes">Review Notes (Optional)</label>
                <textarea
                  id="log-review-notes"
                  className="form-input"
                  rows="3"
                  placeholder="What did you think of it? Excellent screenwriting, pacing, actors...?"
                  value={userReview}
                  onChange={(e) => setUserReview(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseLogModal}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-log"
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                >
                  Save Log Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
