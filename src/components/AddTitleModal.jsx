import React, { useState } from 'react';
import { Film, Tv, Trash, Plus, Search, AlertTriangle, X } from 'lucide-react';
import { fetchLetterboxd, fetchRottenTomatoes, searchImdb, fetchImdbDetails } from '../utils/api';

export default function AddTitleModal({ isOpen, onClose, onAddShow }) {
  // Add Movie / TV Series Form State
  const [showTitle, setShowTitle] = useState('');
  const [showType, setShowType] = useState('movie');
  const [showLanguage, setShowLanguage] = useState('Tamil');
  const [customLanguage, setCustomLanguage] = useState('');
  const [showYear, setShowYear] = useState(new Date().getFullYear());
  const [showPlatform, setShowPlatform] = useState('Netflix');
  const [customPlatform, setCustomPlatform] = useState('');
  const [showReleaseDate, setShowReleaseDate] = useState('');
  const [showGenres, setShowGenres] = useState('');
  const [showOverview, setShowOverview] = useState('');
  const [ratingImdb, setRatingImdb] = useState('');
  const [ratingRT, setRatingRT] = useState('');
  const [ratingRTAudience, setRatingRTAudience] = useState('');
  const [ratingLboxd, setRatingLboxd] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [imdbId, setImdbId] = useState('');
  const [letterboxdSlug, setLetterboxdSlug] = useState('');
  const [rottenTomatoesUrl, setRottenTomatoesUrl] = useState('');

  // Smart Autofill State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  if (!isOpen) return null;

  const handleAutofillSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const matches = await searchImdb(searchQuery.trim());
      if (matches && matches.length > 0) {
        setSearchResults(matches);
      } else {
        setSearchError('No titles found on IMDb matching your search query.');
      }
    } catch (err) {
      console.error(err);
      setSearchError('Error searching IMDb. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (result) => {
    setSearchResults([]); // Close dropdown
    setSearchQuery('');
    
    // Normalize fields from search result
    const title = result.title || result.primaryTitle || '';
    const year = result.year || result.startYear || '';
    const isTv = result.type === 'tvSeries' || result.type === 'tvMiniSeries' || result.type === 'tv';
    
    setShowTitle(title);
    setShowType(isTv ? 'tv' : 'movie');
    if (year) {
      setShowYear(year);
    }
    if (result.posterUrl || result.primaryImage?.url) {
      setPosterUrl(result.posterUrl || result.primaryImage.url);
    }
    setImdbId(result.id || '');
    setLetterboxdSlug('');
    setRatingImdb('');
    setRatingLboxd('');
    setRatingRT('');
    setRatingRTAudience('');
    setRottenTomatoesUrl('');

    // Run all 3 rating lookups concurrently in parallel
    try {
      const [imdbRes, lbRes, rtRes] = await Promise.allSettled([
        fetchImdbDetails(result.id, title, year),
        fetchLetterboxd(title, year, result.id),
        fetchRottenTomatoes(title, year, isTv)
      ]);

      let overviewText = '';
      let genresText = '';

      // 1. Process IMDb details
      if (imdbRes.status === 'fulfilled' && imdbRes.value) {
        const imdbData = imdbRes.value;
        if (imdbData.rating) {
          setRatingImdb(imdbData.rating.toString());
        }
        if (imdbData.overview) {
          overviewText = imdbData.overview;
          setShowOverview(imdbData.overview);
        }
        if (imdbData.genres && imdbData.genres.length > 0) {
          genresText = imdbData.genres.join(', ');
          setShowGenres(genresText);
        }
        if (imdbData.releaseDate) {
          setShowReleaseDate(imdbData.releaseDate);
        }
        if (imdbData.posterUrl && !result.posterUrl && !result.primaryImage?.url) {
          setPosterUrl(imdbData.posterUrl);
        }
        if (imdbData.language) {
          const l = imdbData.language.toLowerCase();
          if (['tamil', 'malayalam', 'hindi', 'english', 'telugu', 'korean', 'japanese'].includes(l)) {
            setShowLanguage(l.charAt(0).toUpperCase() + l.slice(1));
          } else {
            setShowLanguage('Other');
            setCustomLanguage(imdbData.language);
          }
        }
      }

      // 2. Process Letterboxd details
      if (lbRes.status === 'fulfilled' && lbRes.value && !lbRes.value.error) {
        const lbData = lbRes.value;
        if (lbData.rating) {
          setRatingLboxd(lbData.rating.toString());
        }
        if (lbData.slug) {
          setLetterboxdSlug(lbData.slug);
        }
        if (lbData.poster) {
          setPosterUrl(lbData.poster);
        }
        if (lbData.description && !overviewText) {
          setShowOverview(lbData.description);
        }
        if (lbData.genres && lbData.genres.length > 0 && !genresText) {
          setShowGenres(lbData.genres.join(', '));
        }
      }

      // 3. Process Rotten Tomatoes details
      if (rtRes.status === 'fulfilled' && rtRes.value && !rtRes.value.error) {
        const rtData = rtRes.value;
        if (rtData.criticScore !== undefined && rtData.criticScore !== null) {
          setRatingRT(rtData.criticScore.toString());
        }
        if (rtData.audienceScore !== undefined && rtData.audienceScore !== null) {
          setRatingRTAudience(rtData.audienceScore.toString());
        }
        if (rtData.url) {
          setRottenTomatoesUrl(rtData.url);
        }
      }
    } catch (err) {
      console.error('Error fetching title details:', err);
    }

    setIsSearching(false);
  };

  const handleAddShowSubmit = (e) => {
    e.preventDefault();
    if (!showTitle.trim()) return;

    const finalLanguage = showLanguage === 'Other' ? customLanguage.trim() : showLanguage;
    const finalPlatform = showPlatform === 'Other' ? customPlatform.trim() : showPlatform;
    
    // Parse genres from comma separated
    const genresArray = showGenres
      ? showGenres.split(',').map(g => g.trim()).filter(Boolean)
      : ["Drama"];

    const newShow = {
      id: `custom-${Date.now()}`,
      title: showTitle.trim(),
      type: showType,
      language: finalLanguage || 'English',
      year: parseInt(showYear, 10) || new Date().getFullYear(),
      platform: finalPlatform || 'Other',
      releaseDate: showReleaseDate || null,
      genres: genresArray,
      overview: showOverview.trim() || 'No overview available.',
      ratings: {
        imdb: ratingImdb ? parseFloat(ratingImdb) : null,
        rottenTomatoes: ratingRT ? parseInt(ratingRT, 10) : null,
        rottenTomatoesAudience: ratingRTAudience ? parseInt(ratingRTAudience, 10) : null,
        letterboxd: ratingLboxd ? parseFloat(ratingLboxd) : null
      },
      posterUrl: posterUrl.trim() || null,
      imdbId: imdbId.trim() || null,
      letterboxdSlug: letterboxdSlug.trim() || null,
      rottenTomatoesUrl: rottenTomatoesUrl.trim() || null,
      featured: false,
      youtubeTrailer: trailerUrl.trim() || `https://www.youtube.com/results?search_query=${encodeURIComponent(showTitle.trim())}+trailer`
    };

    onAddShow(newShow);
    
    // Reset Form
    setShowTitle('');
    setShowGenres('');
    setShowOverview('');
    setRatingImdb('');
    setRatingRT('');
    setRatingRTAudience('');
    setRatingLboxd('');
    setTrailerUrl('');
    setCustomLanguage('');
    setCustomPlatform('');
    setShowReleaseDate('');
    setPosterUrl('');
    setImdbId('');
    setLetterboxdSlug('');
    setRottenTomatoesUrl('');
    onClose();
  };

  return (
    <div className="scrape-modal-backdrop" onClick={onClose}>
      <div className="scrape-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="scrape-modal-header">
          <h3>
            <span>➕</span> Add Title to Database
          </h3>
          <button 
            className="btn-icon" 
            onClick={onClose}
            style={{ fontSize: '1.25rem', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="scrape-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Smart IMDb Autofill Bar */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-primary)' }}>⚡ Smart IMDb Autofill</h4>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Search for any movie or TV show. We will fetch its synopsis, year, genres, poster, and current ratings from IMDb and Letterboxd automatically!
            </p>
            
            <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
              <input 
                type="text" 
                placeholder="e.g. Maharaja, Inception, Breaking Bad..." 
                className="form-input" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAutofillSearch()}
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                onClick={handleAutofillSearch} 
                className="btn btn-secondary"
                disabled={isSearching}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
              >
                <Search size={14} />
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchError && (
              <p style={{ color: 'var(--error)', fontSize: '0.75rem', margin: '0.5rem 0 0 0' }}>{searchError}</p>
            )}

            {/* Dropdown search results */}
            {searchResults.length > 0 && (
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                marginTop: '0.5rem',
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-secondary)',
                boxShadow: 'var(--shadow-md)'
              }}>
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(result)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.65rem 1rem',
                      border: 'none',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {result.primaryImage?.url ? (
                      <img src={result.primaryImage.url} alt="" style={{ width: '24px', height: '36px', objectFit: 'cover', borderRadius: '2px' }} />
                    ) : (
                      <div style={{ width: '24px', height: '36px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: 'var(--text-muted)' }}>No Poster</div>
                    )}
                    <div>
                      <span style={{ fontWeight: 600 }}>{result.primaryTitle}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({result.startYear || 'N/A'}) • {result.type === 'tvSeries' ? 'TV' : 'Movie'}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleAddShowSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group form-col-full">
              <label className="form-label" htmlFor="modal-show-title">Title *</label>
              <input
                type="text"
                id="modal-show-title"
                className="form-input"
                required
                placeholder="e.g. Maharaja"
                value={showTitle}
                onChange={(e) => setShowTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-show-type">Format</label>
              <select
                id="modal-show-type"
                className="form-input"
                value={showType}
                onChange={(e) => setShowType(e.target.value)}
              >
                <option value="movie">Movie</option>
                <option value="tv">TV Series</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-show-year">Release Year</label>
              <input
                type="number"
                id="modal-show-year"
                className="form-input"
                value={showYear}
                onChange={(e) => setShowYear(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-show-lang">Language</label>
              <select
                id="modal-show-lang"
                className="form-input"
                value={showLanguage}
                onChange={(e) => setShowLanguage(e.target.value)}
              >
                <option value="Tamil">Tamil (Native)</option>
                <option value="Malayalam">Malayalam</option>
                <option value="Hindi">Hindi</option>
                <option value="English">English</option>
                <option value="Other">Other Language...</option>
              </select>
              {showLanguage === 'Other' && (
                <input
                  type="text"
                  placeholder="Type language..."
                  className="form-input"
                  style={{ marginTop: '0.5rem' }}
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-show-platform">Streaming Platform</label>
              <select
                id="modal-show-platform"
                className="form-input"
                value={showPlatform}
                onChange={(e) => setShowPlatform(e.target.value)}
              >
                <option value="Netflix">Netflix</option>
                <option value="Prime Video">Prime Video</option>
                <option value="JioCinema">JioCinema</option>
                <option value="Disney+ Hotstar">Disney+ Hotstar</option>
                <option value="SonyLIV">SonyLIV</option>
                <option value="Rent">Rent (YouTube/Google Play)</option>
                <option value="Other">Other Platform...</option>
              </select>
              {showPlatform === 'Other' && (
                <input
                  type="text"
                  placeholder="Type platform..."
                  className="form-input"
                  style={{ marginTop: '0.5rem' }}
                  value={customPlatform}
                  onChange={(e) => setCustomPlatform(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-show-date">Release Date</label>
              <input
                type="date"
                id="modal-show-date"
                className="form-input"
                value={showReleaseDate}
                onChange={(e) => setShowReleaseDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-show-genres">Genres (Comma separated)</label>
              <input
                type="text"
                id="modal-show-genres"
                className="form-input"
                placeholder="e.g. Action, Thriller, Drama"
                value={showGenres}
                onChange={(e) => setShowGenres(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <h4 style={{ margin: '0.5rem 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ratings & Technical IDs</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>IMDb (/10)</label>
                  <input type="number" step="0.1" className="form-input" placeholder="8.3" value={ratingImdb} onChange={(e) => setRatingImdb(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>RT Critics (%)</label>
                  <input type="number" className="form-input" placeholder="95" value={ratingRT} onChange={(e) => setRatingRT(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>RT Aud (%)</label>
                  <input type="number" className="form-input" placeholder="90" value={ratingRTAudience} onChange={(e) => setRatingRTAudience(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Letterboxd (/5)</label>
                  <input type="number" step="0.01" className="form-input" placeholder="4.1" value={ratingLboxd} onChange={(e) => setRatingLboxd(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>IMDb ID (e.g. tt1234567)</label>
              <input type="text" className="form-input" placeholder="tt26548265" value={imdbId} onChange={(e) => setImdbId(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Letterboxd Slug</label>
              <input type="text" className="form-input" placeholder="maharaja-2024" value={letterboxdSlug} onChange={(e) => setLetterboxdSlug(e.target.value)} />
            </div>

            <div className="form-group form-col-full" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Poster URL</label>
              <input type="url" className="form-input" placeholder="https://..." value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} />
            </div>

            <div className="form-group form-col-full" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Trailer Link (YouTube)</label>
              <input type="url" className="form-input" placeholder="https://..." value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} />
            </div>

            <div className="form-group form-col-full" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Synopsis / Plot</label>
              <textarea className="form-input" rows="2" placeholder="Describe the title..." value={showOverview} onChange={(e) => setShowOverview(e.target.value)} />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Add Title</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
