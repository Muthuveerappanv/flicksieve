import React, { useState, useEffect } from 'react';
import { Compass, RotateCw, Calendar, Bookmark, Settings as SettingsIcon, Star, Filter, Heart, Search as SearchIcon, X, EyeOff } from 'lucide-react';
import { initialShows, initialReviewers } from './data/shows';
import { fetchLetterboxd, fetchRottenTomatoes, getDataFolder, setDataFolder, loadDataFile, saveDataFile } from './utils/api';
import ShowCard from './components/ShowCard';
import DeciderWheel from './components/DeciderWheel';
import OttTracker from './components/OttTracker';
import Watchlist from './components/Watchlist';
import Settings from './components/Settings';
import AddTitleModal from './components/AddTitleModal';

const migrateReviewers = (reviewersList) => {
  if (!Array.isArray(reviewersList)) return reviewersList;
  return reviewersList.map(rev => {
    if (!rev.languages || !Array.isArray(rev.languages)) {
      return {
        ...rev,
        languages: ["tamil", "telugu", "malayalam", "hindi"]
      };
    }
    return rev;
  });
};

export default function App() {
  // --- STATE ---
  const [shows, setShows] = useState(initialShows);
  const [reviewers, setReviewers] = useState(migrateReviewers(initialReviewers));
  const [watchlist, setWatchlist] = useState([]);
  const [watchedHistory, setWatchedHistory] = useState([]);
  const [theme, setTheme] = useState('amethyst');
  const [dataFolder, setDataFolderState] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load data on mount
  useEffect(() => {
    async function loadAllData() {
      try {
        setIsLoadingData(true);
        const folder = await getDataFolder();
        setDataFolderState(folder);
        
        const showsContent = await loadDataFile('shows.json');
        if (showsContent) {
          const parsed = JSON.parse(showsContent);
          if (Array.isArray(parsed)) setShows(parsed);
        } else {
          await saveDataFile('shows.json', JSON.stringify(initialShows, null, 2));
        }

        const reviewersContent = await loadDataFile('reviewers.json');
        if (reviewersContent) {
          const parsed = JSON.parse(reviewersContent);
          if (Array.isArray(parsed)) setReviewers(migrateReviewers(parsed));
        } else {
          await saveDataFile('reviewers.json', JSON.stringify(initialReviewers, null, 2));
        }

        const watchlistContent = await loadDataFile('watchlist.json');
        if (watchlistContent) {
          const parsed = JSON.parse(watchlistContent);
          if (Array.isArray(parsed)) setWatchlist(parsed);
        } else {
          await saveDataFile('watchlist.json', JSON.stringify([], null, 2));
        }

        const historyContent = await loadDataFile('history.json');
        if (historyContent) {
          const parsed = JSON.parse(historyContent);
          if (Array.isArray(parsed)) setWatchedHistory(parsed);
        } else {
          await saveDataFile('history.json', JSON.stringify([], null, 2));
        }

        const themeContent = await loadDataFile('theme.json');
        if (themeContent) {
          let t = themeContent;
          try {
            t = JSON.parse(themeContent);
          } catch(e) {}
          if (t) setTheme(t);
        } else {
          await saveDataFile('theme.json', JSON.stringify('amethyst', null, 2));
        }
      } catch (err) {
        console.error("Error loading FlickSieve data:", err);
      } finally {
        setIsLoadingData(false);
      }
    }
    loadAllData();
  }, []);

  // Apply theme to document element
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
      console.error("Error setting theme attribute:", e);
    }
  }, [theme]);

  // Sync state changes to system files once loaded
  useEffect(() => {
    if (isLoadingData) return;
    saveDataFile('shows.json', JSON.stringify(shows, null, 2))
      .catch(e => console.error("Error saving shows:", e));
  }, [shows, isLoadingData]);

  useEffect(() => {
    if (isLoadingData) return;
    saveDataFile('reviewers.json', JSON.stringify(reviewers, null, 2))
      .catch(e => console.error("Error saving reviewers:", e));
  }, [reviewers, isLoadingData]);

  useEffect(() => {
    if (isLoadingData) return;
    saveDataFile('watchlist.json', JSON.stringify(watchlist, null, 2))
      .catch(e => console.error("Error saving watchlist:", e));
  }, [watchlist, isLoadingData]);

  useEffect(() => {
    if (isLoadingData) return;
    saveDataFile('history.json', JSON.stringify(watchedHistory, null, 2))
      .catch(e => console.error("Error saving history:", e));
  }, [watchedHistory, isLoadingData]);

  useEffect(() => {
    if (isLoadingData) return;
    saveDataFile('theme.json', JSON.stringify(theme, null, 2))
      .catch(e => console.error("Error saving theme:", e));
  }, [theme, isLoadingData]);

  const handleUpdateDataFolder = async (newFolder) => {
    try {
      await setDataFolder(newFolder);
      setDataFolderState(newFolder);
      triggerToast(`Data folder updated to: ${newFolder}`);
      
      const showsContent = await loadDataFile('shows.json');
      if (showsContent) {
        const parsed = JSON.parse(showsContent);
        if (Array.isArray(parsed)) setShows(parsed);
      } else {
        await saveDataFile('shows.json', JSON.stringify(shows, null, 2));
      }

      const reviewersContent = await loadDataFile('reviewers.json');
      if (reviewersContent) {
        const parsed = JSON.parse(reviewersContent);
        if (Array.isArray(parsed)) setReviewers(migrateReviewers(parsed));
      } else {
        await saveDataFile('reviewers.json', JSON.stringify(reviewers, null, 2));
      }

      const watchlistContent = await loadDataFile('watchlist.json');
      if (watchlistContent) {
        const parsed = JSON.parse(watchlistContent);
        if (Array.isArray(parsed)) setWatchlist(parsed);
      } else {
        await saveDataFile('watchlist.json', JSON.stringify(watchlist, null, 2));
      }

      const historyContent = await loadDataFile('history.json');
      if (historyContent) {
        const parsed = JSON.parse(historyContent);
        if (Array.isArray(parsed)) setWatchedHistory(parsed);
      } else {
        await saveDataFile('history.json', JSON.stringify(watchedHistory, null, 2));
      }

      const themeContent = await loadDataFile('theme.json');
      if (themeContent) {
        let t = themeContent;
        try {
          t = JSON.parse(themeContent);
        } catch(e) {}
        if (t) setTheme(t);
      } else {
        await saveDataFile('theme.json', JSON.stringify(theme, null, 2));
      }
    } catch (err) {
      console.error("Error changing/migrating data folder:", err);
      alert(`Failed to update data folder: ${err.message}`);
    }
  };
  // Navigation tab
  const [activeTab, setActiveTab] = useState('recommendations'); // recommendations | wheel | tracker | watchlist | settings

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all'); // all | movie | tv
  const [selectedLanguage, setSelectedLanguage] = useState('All'); // All | Tamil | English | Malayalam | Hindi | Other
  const [selectedPlatform, setSelectedPlatform] = useState('All'); // All | platform_name
  const [minSieveScore, setMinSieveScore] = useState(3.0); // Filter out shows <= 3.0 out of 5
  const [includeUnrated, setIncludeUnrated] = useState(true); // Allow shows with no ratings to bypass sieve

  // Toast notification state
  const [toasts, setToasts] = useState([]);

  // Add Title Modal State
  const [showAddTitleModal, setShowAddTitleModal] = useState(false);

  // Delete Title Modal State
  const [showToDelete, setShowToDelete] = useState(null);

  // --- TOAST HELPER ---
  const triggerToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // --- HANDLERS ---
  const handleToggleWatchlist = (show) => {
    const exists = watchlist.some(item => item.id === show.id);
    if (exists) {
      setWatchlist(prev => prev.filter(item => item.id !== show.id));
      triggerToast(`Removed "${show.title}" from watchlist.`);
    } else {
      setWatchlist(prev => [...prev, show]);
      triggerToast(`Added "${show.title}" to watchlist!`);
    }
  };

  const handleRemoveFromWatchlist = (showId) => {
    setWatchlist(prev => prev.filter(item => item.id !== showId));
  };

  const handleAddToHistory = (logEntry) => {
    setWatchedHistory(prev => [logEntry, ...prev]);
    triggerToast(`Logged "${logEntry.title}" into watched history!`);
  };

  const handleRemoveFromHistory = (logId) => {
    setWatchedHistory(prev => prev.filter(item => item.logId !== logId));
    triggerToast(`Deleted log entry.`);
  };

  // Settings modification handlers
  const handleAddReviewer = (newReviewer) => {
    setReviewers(prev => [...prev, newReviewer]);
    triggerToast(`Added reviewer "${newReviewer.name}"`);
  };

  const handleDeleteReviewer = (reviewerId) => {
    const rev = reviewers.find(r => r.id === reviewerId);
    setReviewers(prev => prev.filter(r => r.id !== reviewerId));
    triggerToast(`Deleted reviewer "${rev?.name}"`);
  };

  const handleUpdateReviewer = (updatedReviewer) => {
    setReviewers(prev => prev.map(r => r.id === updatedReviewer.id ? updatedReviewer : r));
  };


  const handleAddShow = (newShow) => {
    // Sieve check
    const calculateScore = (show) => {
      let total = 0, count = 0;
      if (show.ratings.imdb) { total += show.ratings.imdb / 2; count++; }
      if (show.ratings.rottenTomatoesAudience) { total += show.ratings.rottenTomatoesAudience / 20; count++; }
      if (show.ratings.letterboxd) { total += show.ratings.letterboxd; count++; }
      return count > 0 ? (total / count) : 0;
    };

    const score = calculateScore(newShow);
    setShows(prev => [newShow, ...prev]);
    
    if (score <= minSieveScore) {
      triggerToast(`Added "${newShow.title}". Note: Rating is ${score.toFixed(1)}/5, it will be sieved (filtered) from your active recommendations!`, 'error');
    } else {
      triggerToast(`Successfully added "${newShow.title}" to recommendations!`);
    }
  };

  const handleDeleteShow = (showId) => {
    const show = shows.find(s => s.id === showId);
    if (!show) return;
    setShowToDelete(show);
  };

  const handleConfirmDelete = () => {
    if (!showToDelete) return;
    setShows(prev => prev.filter(s => s.id !== showToDelete.id));
    setWatchlist(prev => prev.filter(item => item.id !== showToDelete.id));
    triggerToast(`Deleted "${showToDelete.title}" from the database.`, 'success');
    setShowToDelete(null);
  };

  const handleRefreshShowRatings = async (showId, triggerNotification = true) => {
    const show = shows.find(s => s.id === showId);
    if (!show) return false;

    try {
      let updatedRatings = { ...show.ratings };
      let currentImdbId = show.imdbId || null;
      let currentOverview = show.overview;
      let currentPosterUrl = show.posterUrl;
      let currentGenres = show.genres;
      let currentYear = show.year;
      let currentSlug = show.letterboxdSlug || null;
      let currentRtUrl = show.rottenTomatoesUrl || null;

      // 1. Fetch IMDb details
      if (currentImdbId) {
        const imdbRes = await fetch(`https://api.imdbapi.dev/titles/${currentImdbId}`);
        if (imdbRes.ok) {
          const details = await imdbRes.json();
          if (details.rating?.aggregateRating) {
            updatedRatings.imdb = details.rating.aggregateRating;
          }
          currentOverview = details.plot || currentOverview;
          if (details.genres && details.genres.length > 0) {
            currentGenres = details.genres;
          }
          if (details.startYear) {
            currentYear = details.startYear;
          }
          if (details.primaryImage?.url) {
            currentPosterUrl = details.primaryImage.url;
          }
        }
      } else {
        // Fallback: search IMDb
        const searchRes = await fetch(`https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(show.title)}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const matches = searchData.titles || [];
          if (matches.length > 0) {
            const bestMatch = matches.find(m => 
              m.primaryTitle.toLowerCase() === show.title.toLowerCase() &&
              (!show.year || Math.abs(m.startYear - show.year) <= 1)
            ) || matches[0];
            
            if (bestMatch) {
              currentImdbId = bestMatch.id;
              updatedRatings.imdb = bestMatch.rating?.aggregateRating || updatedRatings.imdb;
              currentPosterUrl = bestMatch.primaryImage?.url || currentPosterUrl;
              
              const detailRes = await fetch(`https://api.imdbapi.dev/titles/${bestMatch.id}`);
              if (detailRes.ok) {
                const details = await detailRes.json();
                currentOverview = details.plot || currentOverview;
                if (details.genres && details.genres.length > 0) {
                  currentGenres = details.genres;
                }
                if (details.startYear) {
                  currentYear = details.startYear;
                }
              }
            }
          }
        }
      }

      // 2. Fetch Letterboxd rating
      try {
        const lbData = await fetchLetterboxd(show.title, currentYear, currentImdbId);
        if (lbData && !lbData.error) {
          if (lbData.rating) {
            updatedRatings.letterboxd = parseFloat(lbData.rating);
          }
          if (lbData.slug) {
            currentSlug = lbData.slug;
          }
        }
      } catch (err) {
        console.error(`Letterboxd refresh error for ${show.title}:`, err);
      }

      // 2.5 Fetch Rotten Tomatoes rating
      try {
        const rtData = await fetchRottenTomatoes(show.title, currentYear, show.type === 'tv');
        if (rtData && !rtData.error) {
          if (rtData.criticScore !== undefined && rtData.criticScore !== null) {
            updatedRatings.rottenTomatoes = parseInt(rtData.criticScore, 10);
          }
          if (rtData.audienceScore !== undefined && rtData.audienceScore !== null) {
            updatedRatings.rottenTomatoesAudience = parseInt(rtData.audienceScore, 10);
          }
          if (rtData.url) {
            currentRtUrl = rtData.url;
          }
        }
      } catch (err) {
        console.error(`Rotten Tomatoes refresh error for ${show.title}:`, err);
      }

      // 3. Update state
      setShows(prev => prev.map(s => {
        if (s.id === showId) {
          return {
            ...s,
            imdbId: currentImdbId,
            ratings: updatedRatings,
            overview: currentOverview,
            genres: currentGenres,
            year: currentYear,
            posterUrl: currentPosterUrl,
            letterboxdSlug: currentSlug,
            rottenTomatoesUrl: currentRtUrl
          };
        }
        return s;
      }));

      if (triggerNotification) {
        triggerToast(`Refreshed ratings for "${show.title}"!`, 'success');
      }
      return true;
    } catch (e) {
      console.error(`Error refreshing ratings for ${show.title}:`, e);
      if (triggerNotification) {
        triggerToast(`Failed to refresh ratings for "${show.title}".`, 'error');
      }
      return false;
    }
  };

  const handleImportNewShows = (newShows) => {
    // Generate IDs for imported shows
    const showsToImport = newShows.map(show => ({
      ...show,
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      featured: false
    }));

    setShows(prev => [...showsToImport, ...prev]);
    triggerToast(`Imported ${showsToImport.length} shows!`, 'success');

    // Run background resolver to fetch details for each imported show
    showsToImport.forEach(async (importedShow) => {
      let currentImdbId = importedShow.imdbId || null;
      let currentImdbRating = importedShow.ratings?.imdb || null;
      let currentPosterUrl = importedShow.posterUrl || null;
      let currentOverview = importedShow.overview || '';
      let currentGenres = importedShow.genres || [];
      let currentYear = importedShow.year || null;

      // Self-healing: if IMDb details are missing, fetch them now from the client side!
      if (!currentImdbId) {
        try {
          const searchRes = await fetch(`https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(importedShow.title)}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const matches = searchData.titles || [];
            let match = null;
            if (matches.length > 0) {
              const scrapedYear = importedShow.releaseDate ? parseInt(importedShow.releaseDate.split('-')[0], 10) : null;
              const scrapedType = importedShow.type; // 'movie' or 'tv'
              let highestScore = -1000;
              
              for (const m of matches) {
                let score = 0;
                
                // 1. Title match
                const titleEqual = m.primaryTitle.toLowerCase() === importedShow.title.toLowerCase();
                const titleContains = m.primaryTitle.toLowerCase().includes(importedShow.title.toLowerCase()) || 
                                      importedShow.title.toLowerCase().includes(m.primaryTitle.toLowerCase());
                
                if (titleEqual) score += 100;
                else if (titleContains) score += 30;
                
                // 2. Year match (+/- 1 year difference)
                if (scrapedYear && m.startYear) {
                  const yearDiff = Math.abs(m.startYear - scrapedYear);
                  if (yearDiff === 0) score += 50;
                  else if (yearDiff === 1) score += 20;
                  else if (yearDiff > 2) score -= 40;
                }
                
                // 3. Type match (movie vs series formats)
                if (scrapedType === 'tv') {
                  if (m.type === 'tvSeries' || m.type === 'tvMiniSeries' || m.type === 'tvSpecial') {
                    score += 30;
                  } else {
                    score -= 30;
                  }
                } else {
                  if (m.type === 'movie' || m.type === 'tvMovie' || m.type === 'short') {
                    score += 30;
                  } else {
                    score -= 30;
                  }
                }
                
                // 4. Boost popular matches with rating votes
                if (m.rating?.voteCount) {
                  score += Math.min(Math.log10(m.rating.voteCount) * 2, 10);
                }
                
                if (score > highestScore) {
                  highestScore = score;
                  match = m;
                }
              }
            }
            
            if (match) {
              currentImdbId = match.id;
              currentImdbRating = match.rating?.aggregateRating || null;
              currentPosterUrl = match.primaryImage?.url || null;

              const detailRes = await fetch(`https://api.imdbapi.dev/titles/${match.id}`);
              if (detailRes.ok) {
                const details = await detailRes.json();
                currentOverview = details.plot || '';
                if (details.genres && details.genres.length > 0) {
                  currentGenres = details.genres;
                }
                if (details.startYear) {
                  currentYear = details.startYear;
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error background-resolving IMDb for ${importedShow.title}:`, e);
        }
      }

      // Fetch Letterboxd rating
      let lbRating = null;
      let lbSlug = null;
      let lbPoster = null;

      try {
        const lbData = await fetchLetterboxd(importedShow.title, currentYear, currentImdbId);
        if (lbData && !lbData.error) {
          lbRating = lbData.rating ? parseFloat(lbData.rating) : null;
          lbSlug = lbData.slug || null;
          lbPoster = lbData.poster || null;
        }
      } catch (err) {
        console.error(`Error background-resolving Letterboxd for ${importedShow.title}:`, err);
      }

      // Merge resolved details (both IMDb and Letterboxd) back into state
      setShows(prev => prev.map(s => {
        if (s.id === importedShow.id) {
          return {
            ...s,
            imdbId: currentImdbId || s.imdbId,
            posterUrl: currentPosterUrl || lbPoster || s.posterUrl || null,
            overview: currentOverview || s.overview,
            genres: currentGenres.length > 0 ? currentGenres : s.genres,
            year: currentYear || s.year,
            ratings: {
              ...s.ratings,
              imdb: currentImdbRating || s.ratings.imdb,
              letterboxd: lbRating || s.ratings.letterboxd
            },
            letterboxdSlug: lbSlug || s.letterboxdSlug || null
          };
        }
        return s;
      }));
    });
  };

  const handleResetAllData = () => {
    setShows(initialShows);
    setReviewers(migrateReviewers(initialReviewers));
    setWatchlist([]);
    setWatchedHistory([]);
    localStorage.clear();
    triggerToast(`All application data has been reset to defaults.`, 'success');
  };

  const handleImportData = (imported) => {
    if (imported.shows) setShows(imported.shows);
    if (imported.reviewers) setReviewers(migrateReviewers(imported.reviewers));
    if (imported.watchlist) setWatchlist(imported.watchlist);
    if (imported.watchedHistory) setWatchedHistory(imported.watchedHistory);
  };

  const handleExportDataJSON = () => {
    return JSON.stringify({
      shows,
      reviewers,
      watchlist,
      watchedHistory
    }, null, 2);
  };

  // --- SIEVING & FILTERING LOGIC ---
  const calculateShowScore = (show) => {
    let total = 0;
    let count = 0;
    if (show.ratings.imdb !== undefined && show.ratings.imdb !== null) {
      total += show.ratings.imdb / 2;
      count++;
    }
    if (show.ratings.rottenTomatoesAudience !== undefined && show.ratings.rottenTomatoesAudience !== null) {
      total += show.ratings.rottenTomatoesAudience / 20;
      count++;
    }
    if (show.ratings.letterboxd !== undefined && show.ratings.letterboxd !== null) {
      total += show.ratings.letterboxd;
      count++;
    }
    return count > 0 ? total / count : 0;
  };

  // Total shows in DB
  const totalShowsInDb = shows.length;

  // Perform Sieving
  const sievedShows = React.useMemo(() => {
    return shows.filter(show => {
      // 1. Sieve threshold check: Must be greater than minimum threshold (e.g. 3.0/5)
      // If the user is explicitly searching for a title, bypass the sieve score threshold
      const titleMatchesSearch = searchTerm && show.title.toLowerCase().includes(searchTerm.toLowerCase());
      const score = calculateShowScore(show);
      const isUnrated = show.ratings.imdb === null && show.ratings.rottenTomatoes === null && show.ratings.letterboxd === null;
      
      if (!titleMatchesSearch) {
        if (isUnrated) {
          if (!includeUnrated) return false;
        } else {
          if (score <= minSieveScore) return false;
        }
      }

      // 2. Search Text
      if (searchTerm && !show.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !show.genres.some(g => g.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }

      // 3. Media Type (Movie/Series)
      if (selectedType !== 'all' && show.type !== selectedType) {
        return false;
      }

      // 4. Platform
      if (selectedPlatform !== 'All' && show.platform !== selectedPlatform) {
        return false;
      }

      // 5. Language
      if (selectedLanguage !== 'All') {
        if (selectedLanguage === 'Other') {
          // If language is not one of the main ones
          return !['tamil', 'english', 'malayalam', 'hindi'].includes(show.language.toLowerCase());
        } else {
          return show.language.toLowerCase() === selectedLanguage.toLowerCase();
        }
      }

      return true;
    });
  }, [shows, searchTerm, selectedType, selectedLanguage, selectedPlatform, minSieveScore, includeUnrated]);

  // Perform Sieving for Sieved Out Shows
  const sievedOutShows = React.useMemo(() => {
    return shows.filter(show => {
      // 1. Sieve threshold check: Must be LESS than or equal to minimum threshold (e.g. 3.0/5)
      // or unrated if includeUnrated is false.
      const titleMatchesSearch = searchTerm && show.title.toLowerCase().includes(searchTerm.toLowerCase());
      const score = calculateShowScore(show);
      const isUnrated = show.ratings.imdb === null && show.ratings.rottenTomatoes === null && show.ratings.letterboxd === null;
      
      let isSievedOut = false;
      if (!titleMatchesSearch) {
        if (isUnrated) {
          if (!includeUnrated) isSievedOut = true;
        } else {
          if (score <= minSieveScore) isSievedOut = true;
        }
      }

      if (!isSievedOut) return false;

      // 2. Search Text
      if (searchTerm && !show.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !show.genres.some(g => g.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }

      // 3. Media Type (Movie/Series)
      if (selectedType !== 'all' && show.type !== selectedType) {
        return false;
      }

      // 4. Platform
      if (selectedPlatform !== 'All' && show.platform !== selectedPlatform) {
        return false;
      }

      // 5. Language
      if (selectedLanguage !== 'All') {
        if (selectedLanguage === 'Other') {
          return !['tamil', 'english', 'malayalam', 'hindi'].includes(show.language.toLowerCase());
        } else {
          return show.language.toLowerCase() === selectedLanguage.toLowerCase();
        }
      }

      return true;
    });
  }, [shows, searchTerm, selectedType, selectedLanguage, selectedPlatform, minSieveScore, includeUnrated]);

  // Compute how many got sieved out due to rating threshold alone
  const sievedOutCount = React.useMemo(() => {
    return shows.filter(show => {
      const score = calculateShowScore(show);
      const isUnrated = show.ratings.imdb === null && show.ratings.rottenTomatoes === null && show.ratings.letterboxd === null;
      if (includeUnrated && isUnrated) return false;
      return score <= minSieveScore;
    }).length;
  }, [shows, minSieveScore, includeUnrated]);

  // Extract unique platforms for select dropdown
  const uniquePlatforms = React.useMemo(() => {
    const list = new Set();
    shows.forEach(s => {
      if (s.platform) list.add(s.platform);
    });
    return Array.from(list);
  }, [shows]);

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <a href="#" className="logo-container" onClick={() => setActiveTab('recommendations')}>
          <span className="logo-icon">🍿</span>
          <span className="logo-text">FlickSieve</span>
        </a>

        <nav>
          <ul className="nav-menu">
            <li>
              <button 
                id="nav-btn-feed"
                className={`nav-item ${activeTab === 'recommendations' ? 'active' : ''}`}
                onClick={() => setActiveTab('recommendations')}
              >
                <Compass />
                Recommendations
              </button>
            </li>
            <li>
              <button 
                id="nav-btn-sieved-out"
                className={`nav-item ${activeTab === 'sieved_out' ? 'active' : ''}`}
                onClick={() => setActiveTab('sieved_out')}
              >
                <EyeOff />
                Sieved Out
              </button>
            </li>
            <li>
              <button 
                id="nav-btn-wheel"
                className={`nav-item ${activeTab === 'wheel' ? 'active' : ''}`}
                onClick={() => setActiveTab('wheel')}
              >
                <RotateCw />
                Decider Wheel
              </button>
            </li>
            <li>
              <button 
                id="nav-btn-tracker"
                className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`}
                onClick={() => setActiveTab('tracker')}
              >
                <Calendar />
                OTT Tracker
              </button>
            </li>
            <li>
              <button 
                id="nav-btn-watchlist"
                className={`nav-item ${activeTab === 'watchlist' ? 'active' : ''}`}
                onClick={() => setActiveTab('watchlist')}
              >
                <Bookmark />
                Watchlist & Log
              </button>
            </li>
            <li>
              <button 
                id="nav-btn-settings"
                className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <SettingsIcon />
                Settings
              </button>
            </li>
          </ul>
        </nav>

        {/* Global Action Button */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <button 
            id="sidebar-add-title-btn"
            className="btn btn-primary"
            onClick={() => setShowAddTitleModal(true)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              width: '100%', 
              justifyContent: 'center', 
              padding: '0.6rem',
              fontSize: '0.85rem',
              fontWeight: '700'
            }}
          >
            <span>➕</span> Add Title
          </button>
        </div>

        {/* User Info native indicator */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">M</div>
            <div className="user-info">
              <span className="user-name">Muthu</span>
              <span className="user-lang">Tamil • Native</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="main-content">
        {/* HEADER BAR */}
        <header className="content-header">
          <div className="header-title-container">
            {activeTab === 'recommendations' && (
              <>
                <h1>Sieved Recommendations</h1>
                <p className="header-subtitle">
                  Aggregating IMDb, Rotten Tomatoes, and Letterboxd. Only ratings &gt; {minSieveScore}/5 shown.
                </p>
              </>
            )}
            {activeTab === 'sieved_out' && (
              <>
                <h1>Sieved Out Titles</h1>
                <p className="header-subtitle">
                  Titles with average ratings below your sieve limit ({minSieveScore}/5) or unrated titles.
                </p>
              </>
            )}
            {activeTab === 'wheel' && (
              <>
                <h1>Decision Paralysis Solver</h1>
                <p className="header-subtitle">Can't decide what to watch? Let the FlickSieve wheel do it.</p>
              </>
            )}
            {activeTab === 'tracker' && (
              <>
                <h1>OTT Release Calendar</h1>
                <p className="header-subtitle">Weekly digital premieres and streaming updates.</p>
              </>
            )}
            {activeTab === 'watchlist' && (
              <>
                <h1>Your Watch Queue</h1>
                <p className="header-subtitle">Keep track of what to watch and write logs for completed titles.</p>
              </>
            )}
            {activeTab === 'settings' && (
              <>
                <h1>Application Configuration</h1>
                <p className="header-subtitle">Customize YouTube reviewers, add titles, and export backups.</p>
              </>
            )}
          </div>

          {/* QUICK DASHBOARD SUMMARY METRICS */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div 
              className={`rating-item rating-clickable ${activeTab === 'recommendations' ? 'active' : ''}`}
              onClick={() => setActiveTab('recommendations')}
              style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'row', gap: '0.75rem', alignItems: 'center' }}
            >
              <div style={{ textAlign: 'left' }}>
                <span className="rating-source-label" style={{ fontSize: '0.6rem' }}>Total in DB</span>
                <span className="rating-value" style={{ fontSize: '1.1rem' }}>{totalShowsInDb}</span>
              </div>
            </div>
            <div 
              className={`rating-item sieved-out-metric-clickable ${activeTab === 'sieved_out' ? 'active' : ''}`}
              onClick={() => setActiveTab('sieved_out')}
              style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'row', gap: '0.75rem', alignItems: 'center', borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.05)' }}
            >
              <div style={{ textAlign: 'left' }}>
                <span className="rating-source-label" style={{ fontSize: '0.6rem', color: 'var(--error)' }}>Sieved Out</span>
                <span className="rating-value" style={{ fontSize: '1.1rem', color: 'var(--error)' }}>{sievedOutCount}</span>
              </div>
            </div>
          </div>
        </header>

        {/* --- VIEW ROUTER --- */}

        {/* VIEW 1: RECOMMENDATIONS FEED */}
        {activeTab === 'recommendations' && (
          <div>
            {/* Filters dashboard */}
            <div className="controls-bar">
              {/* Row 1: Search & Basic select dropdowns */}
              <div className="controls-row-top">
                <div className="search-wrapper">
                  <SearchIcon className="search-icon" />
                  <input
                    type="text"
                    id="search-main"
                    className="search-input"
                    placeholder="Search by title, genre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <select
                  id="filter-type"
                  className="filter-select"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">All Formats</option>
                  <option value="movie">Movies Only</option>
                  <option value="tv">TV Shows Only</option>
                </select>

                <select
                  id="filter-platform"
                  className="filter-select"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                >
                  <option value="All">All Streaming</option>
                  {uniquePlatforms.map(plat => (
                    <option key={plat} value={plat}>{plat}</option>
                  ))}
                </select>
              </div>

              {/* Row 2: Custom buttons for language toggle and ratings sieve slider */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                {/* Language Toggles */}
                <div className="filter-pills-row">
                  <span className="pill-group-label">Languages</span>
                  <button
                    className={`pill ${selectedLanguage === 'All' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('All')}
                  >
                    All
                  </button>
                  <button
                    className={`pill pill-native ${selectedLanguage === 'Tamil' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Tamil')}
                  >
                    Tamil (Native)
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'English' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('English')}
                  >
                    English
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'Malayalam' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Malayalam')}
                  >
                    Malayalam
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'Hindi' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Hindi')}
                  >
                    Hindi
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'Other' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Other')}
                  >
                    Other
                  </button>
                </div>

                {/* Sieve Severity Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Sieve Limit: &gt; {minSieveScore.toFixed(1)}/5
                    </span>
                    <input
                      type="range"
                      id="sieve-slider"
                      min="3.0"
                      max="4.5"
                      step="0.1"
                      value={minSieveScore}
                      onChange={(e) => setMinSieveScore(parseFloat(e.target.value))}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)', width: '100px' }}
                    />
                  </div>
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      fontSize: '0.8rem', 
                      color: 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      borderLeft: '1px solid var(--border-color)', 
                      paddingLeft: '0.75rem' 
                    }}
                  >
                    <input
                      type="checkbox"
                      id="checkbox-include-unrated"
                      checked={includeUnrated}
                      onChange={(e) => setIncludeUnrated(e.target.checked)}
                      style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    Include Unrated
                  </label>
                </div>
              </div>
            </div>

            {/* Results Grid */}
            {sievedShows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🕳️</div>
                <h3>All Content Sieved Out</h3>
                <p>Everything in this filter subset fell below your minimum sieve threshold of {minSieveScore}/5, or no titles match the query.</p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedType('all');
                    setSelectedLanguage('All');
                    setSelectedPlatform('All');
                    setMinSieveScore(3.0);
                    setIncludeUnrated(true);
                  }}
                  style={{ marginTop: '1.25rem' }}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="shows-grid">
                {sievedShows.map(show => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    isInWatchlist={watchlist.some(item => item.id === show.id)}
                    onToggleWatchlist={handleToggleWatchlist}
                    onDeleteShow={handleDeleteShow}
                    onRefreshShowRatings={handleRefreshShowRatings}
                    reviewers={reviewers}
                    minSieveScore={minSieveScore}
                    includeUnrated={includeUnrated}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 1.5: SIEVED OUT FEED */}
        {activeTab === 'sieved_out' && (
          <div>
            {/* Filters dashboard */}
            <div className="controls-bar">
              {/* Row 1: Search & Basic select dropdowns */}
              <div className="controls-row-top">
                <div className="search-wrapper">
                  <SearchIcon className="search-icon" />
                  <input
                    type="text"
                    id="search-main-sieved"
                    className="search-input"
                    placeholder="Search sieved out titles, genre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <select
                  id="filter-type-sieved"
                  className="filter-select"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">All Formats</option>
                  <option value="movie">Movies Only</option>
                  <option value="tv">TV Shows Only</option>
                </select>

                <select
                  id="filter-platform-sieved"
                  className="filter-select"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                >
                  <option value="All">All Streaming</option>
                  {uniquePlatforms.map(plat => (
                    <option key={plat} value={plat}>{plat}</option>
                  ))}
                </select>
              </div>

              {/* Row 2: Custom buttons for language toggle and ratings sieve slider */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                {/* Language Toggles */}
                <div className="filter-pills-row">
                  <span className="pill-group-label">Languages</span>
                  <button
                    className={`pill ${selectedLanguage === 'All' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('All')}
                  >
                    All
                  </button>
                  <button
                    className={`pill pill-native ${selectedLanguage === 'Tamil' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Tamil')}
                  >
                    Tamil (Native)
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'English' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('English')}
                  >
                    English
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'Malayalam' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Malayalam')}
                  >
                    Malayalam
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'Hindi' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Hindi')}
                  >
                    Hindi
                  </button>
                  <button
                    className={`pill ${selectedLanguage === 'Other' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('Other')}
                  >
                    Other
                  </button>
                </div>

                {/* Sieve Severity Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Sieve Limit: &gt; {minSieveScore.toFixed(1)}/5
                    </span>
                    <input
                      type="range"
                      id="sieve-slider-sieved"
                      min="3.0"
                      max="4.5"
                      step="0.1"
                      value={minSieveScore}
                      onChange={(e) => setMinSieveScore(parseFloat(e.target.value))}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)', width: '100px' }}
                    />
                  </div>
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      fontSize: '0.8rem', 
                      color: 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      borderLeft: '1px solid var(--border-color)', 
                      paddingLeft: '0.75rem' 
                    }}
                  >
                    <input
                      type="checkbox"
                      id="checkbox-include-unrated-sieved"
                      checked={includeUnrated}
                      onChange={(e) => setIncludeUnrated(e.target.checked)}
                      style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    Include Unrated
                  </label>
                </div>
              </div>
            </div>

            {/* Results Grid */}
            {sievedOutShows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✨</div>
                <h3>No Sieved Out Titles</h3>
                <p>No titles in this filter subset fell below your minimum sieve threshold of {minSieveScore}/5.</p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedType('all');
                    setSelectedLanguage('All');
                    setSelectedPlatform('All');
                    setMinSieveScore(3.0);
                    setIncludeUnrated(true);
                  }}
                  style={{ marginTop: '1.25rem' }}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="shows-grid">
                {sievedOutShows.map(show => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    isInWatchlist={watchlist.some(item => item.id === show.id)}
                    onToggleWatchlist={handleToggleWatchlist}
                    onDeleteShow={handleDeleteShow}
                    onRefreshShowRatings={handleRefreshShowRatings}
                    reviewers={reviewers}
                    minSieveScore={minSieveScore}
                    includeUnrated={includeUnrated}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: DECIDER WHEEL */}
        {activeTab === 'wheel' && (
          <DeciderWheel 
            matchingShows={sievedShows}
            onToggleWatchlist={handleToggleWatchlist}
            watchlist={watchlist}
          />
        )}

        {/* VIEW 3: OTT TRACKER */}
        {activeTab === 'tracker' && (
          <OttTracker 
            shows={shows}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            reviewers={reviewers}
            onImportNewShows={handleImportNewShows}
          />
        )}

        {/* VIEW 4: WATCHLIST & LOG */}
        {activeTab === 'watchlist' && (
          <Watchlist 
            watchlist={watchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            watchedHistory={watchedHistory}
            onAddToHistory={handleAddToHistory}
            onRemoveFromHistory={handleRemoveFromHistory}
          />
        )}

        {/* VIEW 5: SETTINGS */}
        {activeTab === 'settings' && (
          <Settings 
            shows={shows}
            reviewers={reviewers}
            onAddReviewer={handleAddReviewer}
            onDeleteReviewer={handleDeleteReviewer}
            onUpdateReviewer={handleUpdateReviewer}
            onDeleteShow={handleDeleteShow}
            onRefreshShowRatings={handleRefreshShowRatings}
            onResetAllData={handleResetAllData}
            onImportData={handleImportData}
            exportDataJSON={handleExportDataJSON}
            theme={theme}
            onThemeChange={setTheme}
            dataFolder={dataFolder}
            onUpdateDataFolder={handleUpdateDataFolder}
          />
        )}
      </main>

      {/* ADD TITLE MODAL */}
      <AddTitleModal 
        isOpen={showAddTitleModal}
        onClose={() => setShowAddTitleModal(false)}
        onAddShow={handleAddShow}
      />

      {/* DELETE TITLE CONFIRMATION MODAL */}
      {showToDelete && (
        <div className="modal-overlay" onClick={() => setShowToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Confirm Deletion</h3>
              <button className="modal-close-btn" onClick={() => setShowToDelete(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Are you sure you want to delete <strong style={{ color: 'white' }}>"{showToDelete.title}"</strong> from the database? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowToDelete(null)}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleConfirmDelete}
                  style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', backgroundImage: 'none' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            <span>{t.type === 'error' ? '⚠️' : '✨'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
