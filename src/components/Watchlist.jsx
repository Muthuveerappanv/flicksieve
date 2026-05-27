import React, { useState } from 'react';
import { Clock, CheckCircle, Trash, Star, MessageSquare, Calendar, X } from 'lucide-react';

export default function Watchlist({ 
  watchlist = [], 
  onRemoveFromWatchlist,
  watchedHistory = [],
  onAddToHistory,
  onRemoveFromHistory
}) {
  const [activeTab, setActiveTab] = useState('towatch'); // 'towatch' or 'watched'
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedShowToLog, setSelectedShowToLog] = useState(null);
  
  // Rating & review form states
  const [userRating, setUserRating] = useState(5);
  const [userReview, setUserReview] = useState('');
  const [watchDate, setWatchDate] = useState(new Date().toISOString().split('T')[0]);

  const handleOpenLogModal = (show) => {
    setSelectedShowToLog(show);
    setUserRating(5);
    setUserReview('');
    setWatchDate(new Date().toISOString().split('T')[0]);
    setShowLogModal(true);
  };

  const handleCloseLogModal = () => {
    setShowLogModal(false);
    setSelectedShowToLog(null);
  };

  const handleSubmitLog = (e) => {
    e.preventDefault();
    if (!selectedShowToLog) return;

    const logEntry = {
      ...selectedShowToLog,
      loggedRating: userRating,
      loggedReview: userReview,
      loggedDate: watchDate,
      logId: `${selectedShowToLog.id}-${Date.now()}`
    };

    onAddToHistory(logEntry);
    onRemoveFromWatchlist(selectedShowToLog.id); // Remove from 'to watch' after marking watched
    handleCloseLogModal();
  };

  // Helper to calculate original score
  const getAverageScore = (show) => {
    let total = 0;
    let count = 0;
    const { ratings } = show;
    if (ratings.imdb) { total += ratings.imdb / 2; count++; }
    if (ratings.rottenTomatoesAudience) { total += ratings.rottenTomatoesAudience / 20; count++; }
    if (ratings.letterboxd) { total += ratings.letterboxd; count++; }
    return count > 0 ? (total / count).toFixed(1) : 'N/A';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Sub tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '2rem' }}>
        <button
          className="nav-item"
          id="btn-tab-towatch"
          onClick={() => setActiveTab('towatch')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'towatch' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            color: activeTab === 'towatch' ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
        >
          <Clock size={16} />
          To Watch ({watchlist.length})
        </button>
        <button
          className="nav-item"
          id="btn-tab-watched"
          onClick={() => setActiveTab('watched')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'watched' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            color: activeTab === 'watched' ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
        >
          <CheckCircle size={16} />
          Watched History ({watchedHistory.length})
        </button>
      </div>

      {activeTab === 'towatch' ? (
        // TO WATCH GRID
        watchlist.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍿</div>
            <h3>Watchlist is Empty</h3>
            <p>Go to the Recommendations feed and hit the Watchlist button to add titles here!</p>
          </div>
        ) : (
          <div className="shows-grid">
            {watchlist.map(show => (
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
                    <span>Sieve Score: ★ {getAverageScore(show)}</span>
                  </div>

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
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // WATCHED HISTORY LIST
        watchedHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎬</div>
            <h3>No Watched History Yet</h3>
            <p>Log shows you've watched from your watchlist to build your rating history!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {watchedHistory.map(entry => (
              <div 
                className="channel-item" 
                key={entry.logId} 
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', padding: '1.25rem' }}
                id={`history-item-${entry.id}`}
              >
                <div 
                  className="avatar" 
                  style={{ 
                    borderRadius: '8px', 
                    width: '50px', 
                    height: '50px', 
                    fontSize: '1.2rem',
                    background: entry.language.toLowerCase() === 'tamil' ? 'linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)' : 'var(--accent-gradient)'
                  }}
                >
                  {entry.type === 'movie' ? '🎬' : '📺'}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>{entry.title}</h4>
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
                  <Trash size={14} />
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
                <h4 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.25rem' }}>{selectedShowToLog.title}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedShowToLog.year} • {selectedShowToLog.language} • {selectedShowToLog.platform}
                </p>
              </div>

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
