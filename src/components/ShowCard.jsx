import React, { useState, useRef, useEffect } from 'react';
import { Star, Film, Tv, Bookmark, Youtube, ChevronDown, ExternalLink, Trash2, RotateCw } from 'lucide-react';

export default function ShowCard({ 
  show, 
  isInWatchlist, 
  onToggleWatchlist, 
  onDeleteShow,
  onRefreshShowRatings,
  reviewers = [],
  minSieveScore = 3.0,
  includeUnrated = true
}) {
  const [showYoutubeMenu, setShowYoutubeMenu] = useState(false);
  const menuRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSeasonsDrawer, setShowSeasonsDrawer] = useState(false);

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

  const { title, type, language, year, genres, overview, ratings, platform, youtubeTrailer, posterUrl, imdbId, letterboxdSlug, rottenTomatoesUrl, totalSeasons, yearSpan, seasons } = show;

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

    if (type === 'tv') {
      // For TV: Use RT Critic score as the 3rd pillar (or Letterboxd if present, e.g. miniseries)
      if (ratings.letterboxd !== undefined && ratings.letterboxd !== null) {
        total += ratings.letterboxd;
        count++;
      } else if (ratings.rottenTomatoes !== undefined && ratings.rottenTomatoes !== null) {
        total += ratings.rottenTomatoes / 20;
        count++;
      }
    } else {
      // For Movie: Use Letterboxd
      if (ratings.letterboxd !== undefined && ratings.letterboxd !== null) {
        total += ratings.letterboxd; // Already 5-scale
        count++;
      }
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

  const showLanguage = (language || '').toLowerCase();
  const matchingReviewers = reviewers.filter(rev => {
    const revLangs = (rev.languages || []).map(l => l.toLowerCase());
    return revLangs.includes(showLanguage);
  });

  const handleYoutubeReviewSearch = (reviewerName) => {
    const query = encodeURIComponent(`${reviewerName} ${title} ${type === 'tv' ? 'series ' : ''}review`);
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
            {type === 'tv' && (totalSeasons || (seasons && seasons.length > 0)) && (
              <span className="tag-platform" style={{ background: 'rgba(255, 255, 255, 0.15)', color: 'var(--text-primary)' }}>
                {(totalSeasons || seasons.length) === 1 ? '1 Season' : `${totalSeasons || seasons.length} Seasons`}
              </span>
            )}
            {((sieveScore !== 'N/A' && parseFloat(sieveScore) <= minSieveScore) || (sieveScore === 'N/A' && !includeUnrated)) && (
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
            <span>{yearSpan || year}</span>
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
            {(ratings.imdb || imdbId) && (
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
                  <Star size={12} fill={ratings.imdb ? "currentColor" : "none"} />
                  {ratings.imdb ? `${ratings.imdb}/10` : 'Unrated'}
                </span>
              </a>
            )}
            {ratings.rottenTomatoesAudience ? (
              <a 
                href={rottenTomatoesUrl || `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rating-item rating-clickable" 
                title="Popcornmeter (Audience Score)"
                style={{ textDecoration: 'none' }}
              >
                <span className="rating-source-label">{type === 'tv' ? 'RT (Aud)' : 'RT'}</span>
                <span className="rating-value">
                  <Star size={12} fill="currentColor" />
                  {ratings.rottenTomatoesAudience}%
                </span>
              </a>
            ) : null}
            {ratings.rottenTomatoes && (type === 'tv' || !ratings.rottenTomatoesAudience) ? (
              <a 
                href={rottenTomatoesUrl || `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rating-item rating-clickable" 
                title="Tomatometer (Critics Score)"
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

        {/* TV Season Ratings Breakdown */}
        {type === 'tv' && seasons && seasons.length > 0 && (
          <div className="seasons-breakdown-container">
            <button
              type="button"
              className="seasons-toggle-btn"
              onClick={() => setShowSeasonsDrawer(!showSeasonsDrawer)}
              title="View Rotten Tomatoes season-by-season ratings"
            >
              <span>📊 Season Ratings ({seasons.length})</span>
              <ChevronDown 
                size={14} 
                style={{ 
                  transform: showSeasonsDrawer ? 'rotate(180deg)' : 'none', 
                  transition: 'transform 0.2s' 
                }} 
              />
            </button>
            {showSeasonsDrawer && (
              <div className="seasons-drawer">
                {seasons.map((s, idx) => (
                  <div key={idx} className="season-row">
                    <span className="season-label">{s.season || `Season ${idx + 1}`}</span>
                    <div className="season-scores">
                      {s.criticScore !== null && s.criticScore !== undefined && (
                        <span className="season-score critic" title="Tomatometer (Critics)">
                          🍅 {s.criticScore}%
                        </span>
                      )}
                      {s.audienceScore !== null && s.audienceScore !== undefined && (
                        <span className="season-score audience" title="Popcornmeter (Audience)">
                          🍿 {s.audienceScore}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                {matchingReviewers.length === 0 ? (
                  <button 
                    className="youtube-menu-item"
                    onClick={() => handleYoutubeReviewSearch("movie review")}
                  >
                    Generic Review Search
                  </button>
                ) : (
                  matchingReviewers.map(rev => (
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
