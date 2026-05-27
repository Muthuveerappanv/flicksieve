import React, { useState, useRef, useEffect } from 'react';
import { Star, Film, Tv, Bookmark, Youtube, ChevronDown, ExternalLink, Trash2, RotateCw } from 'lucide-react';

export default function ShowCard({ 
  show, 
  isInWatchlist, 
  onToggleWatchlist, 
  onDeleteShow,
  onRefreshShowRatings,
  reviewers = [],
  minSieveScore = 3.0
}) {
  const [showYoutubeMenu, setShowYoutubeMenu] = useState(false);
  const menuRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Close YouTube dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowYoutubeMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { title, type, language, year, genres, overview, ratings, platform, youtubeTrailer, posterUrl, imdbId, letterboxdSlug, rottenTomatoesUrl } = show;

  // Calculate Sieve Score out of 5
  const calculateSieveScore = () => {
    let total = 0;
    let count = 0;

    if (ratings.imdb !== undefined && ratings.imdb !== null) {
      total += ratings.imdb / 2; // Convert 10-scale to 5-scale
      count++;
    }
    if (ratings.rottenTomatoesAudience !== undefined && ratings.rottenTomatoesAudience !== null) {
      total += ratings.rottenTomatoesAudience / 20; // Convert 100-scale to 5-scale
      count++;
    }
    if (ratings.letterboxd !== undefined && ratings.letterboxd !== null) {
      total += ratings.letterboxd; // Already 5-scale
      count++;
    }

    if (count === 0) return 'N/A';
    return (total / count).toFixed(2);
  };

  const sieveScore = calculateSieveScore();

  // Dynamic poster gradient style based on language
  const getPosterGradientClass = () => {
    const lang = language.toLowerCase();
    if (lang === 'tamil') return 'poster-gradient-tamil';
    if (lang === 'malayalam') return 'poster-gradient-malayalam';
    if (lang === 'english') return 'poster-gradient-english';
    if (lang === 'hindi') return 'poster-gradient-hindi';
    return 'poster-gradient-other';
  };

  const isNative = language.toLowerCase() === 'tamil';

  const handleYoutubeReviewSearch = (reviewerName) => {
    const query = encodeURIComponent(`${reviewerName} ${title} review`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
    setShowYoutubeMenu(false);
  };

  return (
    <article className="show-card" id={`show-card-${show.id}`}>
      {/* Visual Poster Header */}
      <div className={`card-poster ${getPosterGradientClass()}`}>
        {posterUrl && (
          <img 
            src={posterUrl} 
            alt={title} 
            className="card-poster-img"
            loading="lazy"
          />
        )}
        <div className="card-top-tags" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span className="tag-platform">{platform}</span>
            <span className="tag-type">
              {type === 'movie' ? <Film size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} /> : <Tv size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} />}
              {type === 'movie' ? 'Movie' : 'Series'}
            </span>
            {sieveScore !== 'N/A' && parseFloat(sieveScore) <= minSieveScore && (
              <span className="tag-type" style={{ backgroundColor: 'rgba(239, 68, 68, 0.85)', color: 'white', fontWeight: 600 }}>
                Sieved Out
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {onRefreshShowRatings && (
              <button 
                className={`card-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsRefreshing(true);
                  await onRefreshShowRatings(show.id);
                  setIsRefreshing(false);
                }}
                disabled={isRefreshing}
                title="Refresh Ratings"
                aria-label="Refresh ratings"
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'var(--text-muted)',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  pointerEvents: isRefreshing ? 'none' : 'auto'
                }}
                onMouseEnter={(e) => {
                  if (!isRefreshing) {
                    e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isRefreshing) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <RotateCw 
                  size={12} 
                  style={{
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    color: isRefreshing ? 'var(--accent-primary)' : 'inherit'
                  }}
                />
              </button>
            )}
            {onDeleteShow && (
              <button 
                className="card-delete-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteShow(show.id);
                }}
                title="Delete from Database"
                aria-label="Delete title"
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'var(--text-muted)',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="card-title-meta">
          <div className="card-year-lang">
            <span>{year}</span>
            <span className={`lang-badge ${isNative ? 'lang-native-badge' : ''}`}>
              {language} {isNative && '• Native'}
            </span>
          </div>
          <h3 className="card-title" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{title}</h3>
        </div>
      </div>

      {/* Card Content Details */}
      <div className="card-body">
        <p className="card-overview" title={overview}>{overview}</p>
        
        <div className="card-genres">
          {genres.map((genre, idx) => (
            <span key={idx} className="genre-tag">{genre}</span>
          ))}
        </div>

        {/* Ratings Section */}
        <section className="ratings-section">
          <div className="ratings-grid">
            {ratings.imdb && (
              <a 
                href={imdbId ? `https://www.imdb.com/title/${imdbId}` : `https://www.imdb.com/find?q=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rating-item rating-clickable" 
                title="View on IMDb (opens in new tab)"
                style={{ textDecoration: 'none' }}
              >
                <span className="rating-source-label">IMDb</span>
                <span className="rating-value">
                  <Star size={12} fill="currentColor" />
                  {ratings.imdb}/10
                </span>
              </a>
            )}
            {ratings.rottenTomatoesAudience ? (
              <a 
                href={rottenTomatoesUrl || `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rating-item rating-clickable tooltip-container" 
                style={{ textDecoration: 'none' }}
              >
                <span className="rating-source-label">RT</span>
                <span className="rating-value">
                  <Star size={12} fill="currentColor" />
                  {ratings.rottenTomatoesAudience}%
                </span>
                {ratings.rottenTomatoes && (
                  <span className="tooltip-text">
                    Critics Score: {ratings.rottenTomatoes}%
                  </span>
                )}
              </a>
            ) : ratings.rottenTomatoes ? (
              <a 
                href={rottenTomatoesUrl || `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rating-item rating-clickable" 
                style={{ textDecoration: 'none' }}
              >
                <span className="rating-source-label">RT (Crit)</span>
                <span className="rating-value">
                  <Star size={12} fill="currentColor" />
                  {ratings.rottenTomatoes}%
                </span>
              </a>
            ) : null}
            {ratings.letterboxd && (
              <a 
                href={letterboxdSlug ? `https://letterboxd.com/film/${letterboxdSlug}` : `https://letterboxd.com/search/${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rating-item rating-clickable" 
                title="View on Letterboxd (opens in new tab)"
                style={{ textDecoration: 'none' }}
              >
                <span className="rating-source-label">Lboxd</span>
                <span className="rating-value">
                  <Star size={12} fill="currentColor" />
                  {ratings.letterboxd}/5
                </span>
              </a>
            )}
          </div>

          <div className="sieve-score-container">
            <span className="sieve-score-label">Sieve Score</span>
            <span className="sieve-score-value">
              <Star size={16} fill="currentColor" />
              {sieveScore === 'N/A' ? (
                <span>N/A</span>
              ) : (
                <>
                  {sieveScore} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 5</span>
                </>
              )}
            </span>
          </div>
        </section>

        {/* Card Footer Actions */}
        <div className="card-actions">
          {/* Watchlist Toggle */}
          <button 
            id={`btn-watch-${show.id}`}
            className={`btn btn-secondary btn-watch ${isInWatchlist ? 'in-watchlist' : ''}`}
            onClick={() => onToggleWatchlist(show)}
          >
            <Bookmark size={15} fill={isInWatchlist ? "currentColor" : "none"} />
            {isInWatchlist ? 'Watchlisted' : 'Watchlist'}
          </button>

          {/* YouTube Review Dropdown */}
          <div className="youtube-menu-container" ref={menuRef}>
            <button 
              id={`btn-review-${show.id}`}
              className="btn btn-secondary"
              onClick={() => setShowYoutubeMenu(!showYoutubeMenu)}
              title="YouTube Reviews"
            >
              <Youtube size={15} style={{ color: '#ef4444' }} />
              Reviews
              <ChevronDown size={12} />
            </button>
            {showYoutubeMenu && (
              <div className="youtube-menu">
                {reviewers.length === 0 ? (
                  <button 
                    className="youtube-menu-item"
                    onClick={() => handleYoutubeReviewSearch("movie review")}
                  >
                    Generic Review Search
                  </button>
                ) : (
                  reviewers.map(rev => (
                    <button 
                      key={rev.id} 
                      className="youtube-menu-item"
                      onClick={() => handleYoutubeReviewSearch(rev.name)}
                    >
                      Search {rev.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Trailer Button */}
          {youtubeTrailer && (
            <a 
              id={`btn-trailer-${show.id}`}
              href={youtubeTrailer}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon"
              title="Watch Trailer / Search"
            >
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
