import React, { useState } from 'react';
import { Calendar, Film, Tv, Star, Bookmark, ExternalLink, Play, Search } from 'lucide-react';
import { fetch91Mobiles, fetchDiscoverAtHome } from '../utils/api';

export default function OttTracker({ 
  shows = [], 
  watchlist = [], 
  onToggleWatchlist, 
  reviewers = [],
  onImportNewShows,
  mediaType = 'movie'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Scraper & Import Modal States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgressText, setScanProgressText] = useState('');
  const [scrapedShows, setScrapedShows] = useState([]);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [importSelection, setImportSelection] = useState({});
  const [imdbFilterThreshold, setImdbFilterThreshold] = useState(6.0);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [showNonPreferredGenres, setShowNonPreferredGenres] = useState(false);

  // Rotten Tomatoes "At Home" discovery states
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [discoverMovies, setDiscoverMovies] = useState([]);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [discoverSelection, setDiscoverSelection] = useState({});
  const [discoverMeta, setDiscoverMeta] = useState(null);
  const [discoverDays, setDiscoverDays] = useState(90);
  const [discoverMinAudience, setDiscoverMinAudience] = useState(70);
  const [discoverSort, setDiscoverSort] = useState('audience'); // 'audience' | 'date'

  const discoverWindowLabel = (d) => `${Math.round(d / 30)} months`;

  const sortedDiscoverMovies = React.useMemo(() => {
    const list = [...discoverMovies];
    if (discoverSort === 'date') {
      list.sort((a, b) =>
        b.streamingDate.localeCompare(a.streamingDate) || b.audienceScore - a.audienceScore);
    } else {
      list.sort((a, b) =>
        b.audienceScore - a.audienceScore ||
        (b.criticScore ?? -1) - (a.criticScore ?? -1) ||
        b.streamingDate.localeCompare(a.streamingDate));
    }
    return list;
  }, [discoverMovies, discoverSort]);

  const PREFERRED_LANGUAGES = ['tamil', 'malayalam', 'hindi', 'english'];
  const NON_PREFERRED_GENRES = ['documentary', 'reality', 'reality-tv', 'animation', 'talk-show', 'news', 'game-show'];

  // Current local time is May 25, 2026.
  const currentDateStr = "2026-05-25";

  // Filter scraped shows based on user preference toggles and active mediaType
  const visibleScrapedShows = React.useMemo(() => {
    return scrapedShows.filter(show => {
      // Media type isolation
      if (mediaType === 'tv') {
        if (show.type !== 'tv') return false;
      } else {
        if (show.type === 'tv') return false;
      }

      // Language filter
      const lang = (show.language || '').toLowerCase();
      if (!showAllLanguages && !PREFERRED_LANGUAGES.includes(lang)) {
        return false;
      }
      
      // Genre filter
      const genres = (show.genres || []).map(g => g.toLowerCase());
      if (!showNonPreferredGenres) {
        const hasNonPreferred = genres.some(g => NON_PREFERRED_GENRES.includes(g));
        if (hasNonPreferred) {
          return false;
        }
      }
      
      return true;
    });
  }, [scrapedShows, showAllLanguages, showNonPreferredGenres, mediaType]);

  // Filter shows that have valid release dates and match active mediaType
  const datedShows = React.useMemo(() => {
    return shows
      .filter(s => s.releaseDate && (s.type || 'movie') === mediaType)
      .filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  }, [shows, searchTerm, mediaType]);

  // Group shows by release date
  const groupedShows = React.useMemo(() => {
    const groups = {};
    datedShows.forEach(show => {
      const date = show.releaseDate;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(show);
    });
    return groups;
  }, [datedShows]);

  // Helper to format date label
  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    const formatted = date.toLocaleDateString('en-US', options);

    if (dateStr === currentDateStr) {
      return (
        <>
          {formatted} <span className="today-badge">Today's Release</span>
        </>
      );
    }

    if (new Date(dateStr) > new Date(currentDateStr)) {
      return (
        <>
          {formatted} <span className="today-badge" style={{ backgroundColor: 'var(--accent-primary)' }}>Upcoming</span>
        </>
      );
    }

    return formatted;
  };

  // Helper to calculate score for badge
  const getAverageScore = (show) => {
    let total = 0;
    let count = 0;
    const { ratings } = show;
    if (ratings.imdb) { total += ratings.imdb / 2; count++; }
    if (ratings.rottenTomatoes) { total += ratings.rottenTomatoes / 20; count++; }
    if (ratings.letterboxd) { total += ratings.letterboxd; count++; }
    return count > 0 ? (total / count).toFixed(1) : 'N/A';
  };

  const isWatchlisted = (showId) => watchlist.some(item => item.id === showId);

  // Scraper Actions
  const handleScanWeeklyReleases = async () => {
    setIsScanning(true);
    setScanProgressText('Connecting...');
    setScrapeError('');
    setScrapedShows([]);
    try {
      const data = await fetch91Mobiles((current, total, title) => {
        if (total === 0) {
          setScanProgressText(title);
        } else {
          setScanProgressText(`Resolving (${current}/${total}): ${title}`);
        }
      });
      if (data.shows && data.shows.length > 0) {
        setScrapedShows(data.shows);
        setShowAllLanguages(false);
        setShowNonPreferredGenres(false);
        
        // Pre-select items with IMDb rating >= 6.0/10 and that are not already in DB
        const initialSelection = {};
        data.shows.forEach(show => {
          const alreadyExists = shows.some(s => s.title.toLowerCase() === show.title.toLowerCase());
          if (!alreadyExists) {
            initialSelection[show.title] = show.ratings.imdb !== null ? show.ratings.imdb >= imdbFilterThreshold : true;
          } else {
            initialSelection[show.title] = false;
          }
        });
        setImportSelection(initialSelection);
        setShowScrapeModal(true);
      } else if (data.error) {
        setScrapeError(data.error);
        alert(`Scan error: ${data.error}`);
      } else {
        setScrapeError('No releases found for this week.');
        alert('No releases found for this week.');
      }
    } catch (err) {
      console.error(err);
      setScrapeError('Error scanning weekly releases. Make sure Python virtual environment is set up.');
      alert(`Error scanning weekly releases: ${err.message}`);
    } finally {
      setIsScanning(false);
      setScanProgressText('');
    }
  };

  const handleToggleSelectShow = (title) => {
    setImportSelection(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const handleSelectAll = (selectVal) => {
    const updated = { ...importSelection };
    visibleScrapedShows.forEach(show => {
      const alreadyExists = shows.some(s => s.title.toLowerCase() === show.title.toLowerCase());
      if (!alreadyExists) {
        updated[show.title] = selectVal;
      } else {
        updated[show.title] = false;
      }
    });
    setImportSelection(updated);
  };

  const handleImportConfirm = () => {
    const showsToImport = visibleScrapedShows.filter(show => importSelection[show.title]);
    if (showsToImport.length > 0 && onImportNewShows) {
      onImportNewShows(showsToImport);
    }
    setShowScrapeModal(false);
    setScrapedShows([]);
  };

  // Rotten Tomatoes "At Home" / TV discovery actions
  const handleDiscoverAtHome = async () => {
    setIsDiscovering(true);
    setDiscoverError('');
    setDiscoverMovies([]);
    try {
      const data = await fetchDiscoverAtHome(discoverDays, discoverMinAudience, discoverSort, mediaType);
      if (data.error) {
        setDiscoverError(data.error);
        alert(`Discovery error: ${data.error}`);
        return;
      }
      const items = data.shows || data.movies || [];
      setDiscoverMovies(items);
      setDiscoverMeta({
        windowDays: data.windowDays,
        minAudience: data.minAudience,
        pagesCrawled: data.pagesCrawled,
        failedPages: data.failedPages || 0,
        count: data.count,
      });

      const initialSelection = {};
      items.forEach(m => {
        const alreadyExists = shows.some(s => s.title.toLowerCase() === m.title.toLowerCase());
        initialSelection[m.title] = !alreadyExists;
      });
      setDiscoverSelection(initialSelection);
      setShowDiscoverModal(true);

      if (items.length === 0) {
        alert(`No new ${mediaType === 'tv' ? 'TV series' : 'at-home movies'} matched. Try a wider window or a lower audience threshold.`);
      }
    } catch (err) {
      console.error(err);
      setDiscoverError(`Error discovering ${mediaType === 'tv' ? 'TV series' : 'at-home movies'}. Make sure the Python virtual environment is set up.`);
      alert(`Error discovering: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleToggleDiscoverMovie = (title) => {
    setDiscoverSelection(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleDiscoverSelectAll = (selectVal) => {
    const updated = { ...discoverSelection };
    discoverMovies.forEach(m => {
      const alreadyExists = shows.some(s => s.title.toLowerCase() === m.title.toLowerCase());
      updated[m.title] = alreadyExists ? false : selectVal;
    });
    setDiscoverSelection(updated);
  };

  const handleDiscoverImportConfirm = () => {
    const itemsToImport = discoverMovies
      .filter(m => discoverSelection[m.title])
      .map(m => ({
        title: m.title,
        type: mediaType,
        language: 'English',
        genres: ['Drama'],
        platform: 'Streaming',
        releaseDate: m.streamingDate,
        overview: '',
        posterUrl: m.posterUrl || null,
        rottenTomatoesUrl: m.url,
        ratings: {
          imdb: null,
          rottenTomatoes: m.criticScore ?? null,
          letterboxd: null,
          rottenTomatoesAudience: m.audienceScore ?? null,
        },
      }));
    if (itemsToImport.length > 0 && onImportNewShows) {
      onImportNewShows(itemsToImport);
    }
    setShowDiscoverModal(false);
    setDiscoverMovies([]);
  };

  return (
    <div className="tracker-container">
      {/* OTT Release Tracker Header Banner */}
      <div className="tracker-banner">
        <div className="banner-content">
          <h2>{mediaType === 'tv' ? 'Weekly TV Series Release Tracker' : 'Weekly OTT Movie Tracker'}</h2>
          <p>
            {mediaType === 'tv'
              ? 'Keeping tabs on new seasons and series premieres across streaming platforms (Netflix, Prime Video, JioCinema, Apple TV+, Hotstar).'
              : 'Keeping tabs on digital premieres across all Indian streaming giants (Netflix, Prime Video, JioCinema, SonyLIV, Hotstar). Sifted to ensure only titles with ratings > 3.0/5 are highlighted.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={handleScanWeeklyReleases}
            disabled={isScanning}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
          >
            {isScanning ? (scanProgressText || 'Scanning...') : (mediaType === 'tv' ? 'Scan TV Releases ⚡' : 'Scan Weekly Releases ⚡')}
          </button>

          <button
            onClick={handleDiscoverAtHome}
            disabled={isDiscovering}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
            title={mediaType === 'tv' ? 'Discover top-rated TV series from Rotten Tomatoes' : "Find new 'at home' movies on Rotten Tomatoes with a strong audience score"}
          >
            {isDiscovering ? 'Discovering...' : (mediaType === 'tv' ? 'Discover TV Series 🍅' : 'Discover At-Home 🍅')}
          </button>

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder={`Search ${mediaType === 'tv' ? 'TV releases' : 'weekly releases'}...`} 
              className="form-input" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '220px' }}
            />
          </div>
        </div>
      </div>

      <div className="tracker-timeline">
        {Object.keys(groupedShows).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>No Releases Listed</h3>
            <p>We couldn't find any OTT release matching your search query.</p>
          </div>
        ) : (
          Object.entries(groupedShows).map(([dateStr, showsInDate]) => (
            <section className="timeline-section" key={dateStr}>
              <h3 className="timeline-date-header">
                <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
                {formatDateLabel(dateStr)}
              </h3>
              
              <div className="tracker-grid">
                {showsInDate.map(show => {
                  const watchlisted = isWatchlisted(show.id);
                  const sieveScore = getAverageScore(show);
                  
                  return (
                    <div className="compact-show-card" key={show.id} id={`tracker-item-${show.id}`}>
                      <div className="compact-icon">
                        {show.type === 'movie' ? <Film size={20} /> : <Tv size={20} />}
                      </div>
                      
                      <div className="compact-details">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h4 className="compact-title">{show.title}</h4>
                          <span className="compact-score-badge">★ {sieveScore}</span>
                        </div>
                        
                        <p className="compact-meta">
                          <span>{show.language}</span> • 
                          <span style={{ color: 'var(--accent-secondary)' }}>{show.platform}</span>
                        </p>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <button 
                            className={`btn btn-secondary btn-icon`}
                            onClick={() => onToggleWatchlist(show)}
                            title={watchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
                            style={{ padding: '0.35rem 0.5rem' }}
                          >
                            <Bookmark size={12} fill={watchlisted ? "currentColor" : "none"} style={{ color: watchlisted ? 'var(--success)' : 'inherit' }} />
                          </button>
                          
                          {/* YouTube search trigger */}
                          <a 
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`review ${show.title}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Play size={10} fill="currentColor" />
                            Trailers
                          </a>

                          <a 
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${show.title} movie review 91mobiles`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            title="Check 91mobiles details"
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

      {/* Scrape Preview & Import Modal */}
      {showScrapeModal && (
        <div className="scrape-modal-backdrop" onClick={() => setShowScrapeModal(false)}>
          <div className="scrape-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="scrape-modal-header">
              <h3>
                <span>📅</span> Scraped Weekly Releases (91mobiles)
              </h3>
              <button 
                className="btn-icon" 
                onClick={() => setShowScrapeModal(false)}
                style={{ fontSize: '1.25rem', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>
            
            <div className="scrape-modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Select releases to import. Titles with an IMDb rating &ge; {imdbFilterThreshold.toFixed(1)}/10 are pre-selected. Titles already in your database are flagged and skipped.
              </p>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem', 
                backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                padding: '0.75rem 1rem', 
                marginBottom: '1.25rem' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => handleSelectAll(true)}
                    >
                      Select All Visible
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => handleSelectAll(false)}
                    >
                      Deselect All Visible
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>IMDb Pre-select: &ge; {imdbFilterThreshold.toFixed(1)}</span>
                    <input
                      type="range"
                      min="5.0"
                      max="8.5"
                      step="0.5"
                      value={imdbFilterThreshold}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setImdbFilterThreshold(val);
                        // Update selection
                        const updated = { ...importSelection };
                        scrapedShows.forEach(show => {
                          const alreadyExists = shows.some(s => s.title.toLowerCase() === show.title.toLowerCase());
                          if (!alreadyExists) {
                            updated[show.title] = show.ratings.imdb !== null ? show.ratings.imdb >= val : true;
                          }
                        });
                        setImportSelection(updated);
                      }}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)', width: '80px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={showAllLanguages} 
                      onChange={(e) => setShowAllLanguages(e.target.checked)}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    Show All Languages (Punjabi, Italian, Telugu, etc.)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={showNonPreferredGenres} 
                      onChange={(e) => setShowNonPreferredGenres(e.target.checked)}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    Show Non-Preferred Genres (Reality, Documentary, Animation)
                  </label>
                </div>
              </div>
              
              {visibleScrapedShows.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  <p>No releases match the current language/genre filter preferences.</p>
                </div>
              ) : (
                visibleScrapedShows.map(show => {
                  const alreadyExists = shows.some(s => s.title.toLowerCase() === show.title.toLowerCase());
                  const isSelected = !!importSelection[show.title];
                  const imdbRating = show.ratings.imdb;
                  
                  let ratingClass = 'rating-low';
                  if (imdbRating >= 7.5) ratingClass = 'rating-high';
                  else if (imdbRating >= 6.0) ratingClass = 'rating-mid';
                  
                  return (
                    <div 
                      key={show.title} 
                      className={`scrape-show-row ${alreadyExists ? 'disabled' : ''}`}
                      onClick={() => !alreadyExists && handleToggleSelectShow(show.title)}
                      style={{ cursor: alreadyExists ? 'default' : 'pointer' }}
                    >
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyExists}
                        onChange={() => {}} // handled by row click
                        style={{ cursor: alreadyExists ? 'default' : 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent-primary)', marginRight: '0.5rem' }}
                      />
                      
                      {show.posterUrl ? (
                        <img src={show.posterUrl} alt={show.title} className="scrape-show-poster" />
                      ) : (
                        <div className="scrape-show-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' }}>No Poster</div>
                      )}
                      
                      <div className="scrape-show-info">
                        <div className="scrape-show-title">{show.title}</div>
                        <div className="scrape-show-meta">
                          <span>{show.language}</span> • <span style={{ color: 'var(--accent-secondary)' }}>{show.platform}</span> • <span>{show.releaseDate || 'Date TBD'}</span>
                        </div>
                      </div>
                      
                      {alreadyExists ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, padding: '0.25rem 0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                          In Database
                        </span>
                      ) : imdbRating !== null ? (
                        <span className={`scrape-show-rating ${ratingClass}`}>
                          ★ {imdbRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="scrape-show-rating" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                          Rating NA
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="scrape-modal-footer">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {visibleScrapedShows.filter(show => importSelection[show.title]).length} releases selected for import
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowScrapeModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleImportConfirm}
                  disabled={visibleScrapedShows.filter(show => importSelection[show.title]).length === 0}
                >
                  Import Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rotten Tomatoes "At Home" Discovery Modal */}
      {showDiscoverModal && (
        <div className="scrape-modal-backdrop" onClick={() => setShowDiscoverModal(false)}>
          <div className="scrape-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="scrape-modal-header">
              <h3>
                <span>🍅</span> New At-Home Movies (Rotten Tomatoes)
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowDiscoverModal(false)}
                style={{ fontSize: '1.25rem', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="scrape-modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Movies that started streaming within {discoverWindowLabel(discoverMeta?.windowDays ?? discoverDays)} with a
                Rotten Tomatoes audience score &ge; {discoverMeta?.minAudience ?? discoverMinAudience}%. Titles
                already in your database are flagged and skipped.
              </p>

              {discoverMeta?.failedPages > 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '1rem' }}>
                  ⚠ {discoverMeta.failedPages} page(s) failed to load (Rotten Tomatoes rate-limited the request).
                  Results may be incomplete — hit Refresh again in a minute.
                </p>
              )}

              <div style={{
                display: 'flex',
                gap: '1.5rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleDiscoverSelectAll(true)}
                  >
                    Select All New
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleDiscoverSelectAll(false)}
                  >
                    Deselect All
                  </button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Window
                  <select
                    value={discoverDays}
                    onChange={(e) => setDiscoverDays(parseInt(e.target.value, 10))}
                    className="form-input"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    <option value={90}>3 months</option>
                    <option value={180}>6 months</option>
                    <option value={365}>12 months</option>
                  </select>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Sort by
                  <select
                    value={discoverSort}
                    onChange={(e) => setDiscoverSort(e.target.value)}
                    className="form-input"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    <option value="audience">Audience score</option>
                    <option value="date">Streaming date</option>
                  </select>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Audience &ge;
                  <select
                    value={discoverMinAudience}
                    onChange={(e) => setDiscoverMinAudience(parseInt(e.target.value, 10))}
                    className="form-input"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    <option value={60}>60%</option>
                    <option value={70}>70%</option>
                    <option value={80}>80%</option>
                    <option value={90}>90%</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  onClick={handleDiscoverAtHome}
                  disabled={isDiscovering}
                >
                  {isDiscovering ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {sortedDiscoverMovies.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍅</div>
                  <p>No at-home movies matched. Try a wider window or a lower audience threshold.</p>
                </div>
              ) : (
                sortedDiscoverMovies.map(m => {
                  const alreadyExists = shows.some(s => s.title.toLowerCase() === m.title.toLowerCase());
                  const isSelected = !!discoverSelection[m.title];

                  let ratingClass = 'rating-low';
                  if (m.audienceScore >= 85) ratingClass = 'rating-high';
                  else if (m.audienceScore >= 70) ratingClass = 'rating-mid';

                  return (
                    <div
                      key={m.title}
                      className={`scrape-show-row ${alreadyExists ? 'disabled' : ''}`}
                      onClick={() => !alreadyExists && handleToggleDiscoverMovie(m.title)}
                      style={{ cursor: alreadyExists ? 'default' : 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyExists}
                        onChange={() => {}}
                        style={{ cursor: alreadyExists ? 'default' : 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent-primary)', marginRight: '0.5rem' }}
                      />

                      {m.posterUrl ? (
                        <img src={m.posterUrl} alt={m.title} className="scrape-show-poster" />
                      ) : (
                        <div className="scrape-show-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' }}>No Poster</div>
                      )}

                      <div className="scrape-show-info">
                        <div className="scrape-show-title">
                          {m.title}
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginLeft: '0.4rem', color: 'var(--text-muted)' }}
                            title="Open on Rotten Tomatoes"
                          >
                            <ExternalLink size={11} />
                          </a>
                        </div>
                        <div className="scrape-show-meta">
                          <span>Streaming {m.streamingDate}</span>
                          {' • '}
                          <span>Critics {m.criticScore != null ? `${m.criticScore}%` : 'NA'}</span>
                        </div>
                      </div>

                      {alreadyExists ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, padding: '0.25rem 0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                          In Database
                        </span>
                      ) : (
                        <span className={`scrape-show-rating ${ratingClass}`}>
                          🍅 {m.audienceScore}%
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="scrape-modal-footer">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {discoverMovies.filter(m => discoverSelection[m.title]).length} movies selected for import
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => setShowDiscoverModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleDiscoverImportConfirm}
                  disabled={discoverMovies.filter(m => discoverSelection[m.title]).length === 0}
                >
                  Import Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
