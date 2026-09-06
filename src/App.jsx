import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Compass, RotateCw, Bookmark, Settings as SettingsIcon, Sparkles, X, EyeOff } from 'lucide-react';
import { initialShows, initialReviewers } from './data/shows';
import { fetchLetterboxd, fetchRottenTomatoes, fetchImdbDetails, getDataFolder, setDataFolder, loadDataFile, saveDataFile } from './utils/api';
import { calculateSieveScore, isUnrated } from './utils/score';
import DeciderWheel from './components/DeciderWheel';
import OttTracker from './components/OttTracker';
import Watchlist from './components/Watchlist';
import Settings from './components/Settings';
import AddTitleModal from './components/AddTitleModal';
import FilterBar from './components/FilterBar';
import ShowGrid from './components/ShowGrid';
import { useToast } from './context/ToastContext';

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

/**
 * Runs `effect` ~`delay`ms after `deps` last changed, collapsing bursts of
 * state changes into a single trailing call. Used for the write-through
 * persistence effects so keystroke-rate state updates don't hammer the disk.
 */
function useDebouncedEffect(effect, deps, delay = 500) {
  const effectRef = useRef(effect);
  effectRef.current = effect;
  useEffect(() => {
    const handle = setTimeout(() => effectRef.current(), delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}

/**
 * Loads shows / reviewers / watchlist / history / theme from the data folder,
 * seeding each file from `fallbacks` when it does not yet exist. Shared by the
 * initial mount load and the data-folder migration handler.
 */
async function loadAll(fallbacks, { setShows, setReviewers, setWatchlist, setWatchedHistory, setTheme }) {
  const showsContent = await loadDataFile('shows.json');
  if (showsContent) {
    const parsed = JSON.parse(showsContent);
    if (Array.isArray(parsed)) setShows(parsed);
  } else {
    await saveDataFile('shows.json', JSON.stringify(fallbacks.shows, null, 2));
  }

  const reviewersContent = await loadDataFile('reviewers.json');
  if (reviewersContent) {
    const parsed = JSON.parse(reviewersContent);
    if (Array.isArray(parsed)) setReviewers(migrateReviewers(parsed));
  } else {
    await saveDataFile('reviewers.json', JSON.stringify(fallbacks.reviewers, null, 2));
  }

  const watchlistContent = await loadDataFile('watchlist.json');
  if (watchlistContent) {
    const parsed = JSON.parse(watchlistContent);
    if (Array.isArray(parsed)) setWatchlist(parsed);
  } else {
    await saveDataFile('watchlist.json', JSON.stringify(fallbacks.watchlist, null, 2));
  }

  const historyContent = await loadDataFile('history.json');
  if (historyContent) {
    const parsed = JSON.parse(historyContent);
    if (Array.isArray(parsed)) setWatchedHistory(parsed);
  } else {
    await saveDataFile('history.json', JSON.stringify(fallbacks.watchedHistory, null, 2));
  }

  const themeContent = await loadDataFile('theme.json');
  if (themeContent) {
    let t = themeContent;
    try {
      t = JSON.parse(themeContent);
    } catch (e) {
      // theme.json may hold a bare string written by an older build
    }
    if (t) setTheme(t);
  } else {
    await saveDataFile('theme.json', JSON.stringify(fallbacks.theme, null, 2));
  }
}

export default function App() {
  const triggerToast = useToast();

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
    async function bootstrap() {
      try {
        setIsLoadingData(true);
        const folder = await getDataFolder();
        setDataFolderState(folder);
        await loadAll(
          { shows: initialShows, reviewers: initialReviewers, watchlist: [], watchedHistory: [], theme: 'amethyst' },
          { setShows, setReviewers, setWatchlist, setWatchedHistory, setTheme }
        );
      } catch (err) {
        console.error("Error loading FlickSieve data:", err);
      } finally {
        setIsLoadingData(false);
      }
    }
    bootstrap();
  }, []);

  // Apply theme to document element (immediate, not debounced)
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
      console.error("Error setting theme attribute:", e);
    }
  }, [theme]);

  // Sync state changes to system files once loaded (debounced ~500ms)
  useDebouncedEffect(() => {
    if (isLoadingData) return;
    saveDataFile('shows.json', JSON.stringify(shows, null, 2))
      .catch(e => console.error("Error saving shows:", e));
  }, [shows, isLoadingData]);

  useDebouncedEffect(() => {
    if (isLoadingData) return;
    saveDataFile('reviewers.json', JSON.stringify(reviewers, null, 2))
      .catch(e => console.error("Error saving reviewers:", e));
  }, [reviewers, isLoadingData]);

  useDebouncedEffect(() => {
    if (isLoadingData) return;
    saveDataFile('watchlist.json', JSON.stringify(watchlist, null, 2))
      .catch(e => console.error("Error saving watchlist:", e));
  }, [watchlist, isLoadingData]);

  useDebouncedEffect(() => {
    if (isLoadingData) return;
    saveDataFile('history.json', JSON.stringify(watchedHistory, null, 2))
      .catch(e => console.error("Error saving history:", e));
  }, [watchedHistory, isLoadingData]);

  useDebouncedEffect(() => {
    if (isLoadingData) return;
    saveDataFile('theme.json', JSON.stringify(theme, null, 2))
      .catch(e => console.error("Error saving theme:", e));
  }, [theme, isLoadingData]);

  const handleUpdateDataFolder = async (newFolder) => {
    try {
      await setDataFolder(newFolder);
      setDataFolderState(newFolder);
      triggerToast(`Data folder updated to: ${newFolder}`);
      await loadAll(
        { shows, reviewers, watchlist, watchedHistory, theme },
        { setShows, setReviewers, setWatchlist, setWatchedHistory, setTheme }
      );
    } catch (err) {
      console.error("Error changing/migrating data folder:", err);
      alert(`Failed to update data folder: ${err.message}`);
    }
  };

  // Navigation tab
  const [activeTab, setActiveTab] = useState('recommendations'); // recommendations | sieved_out | wheel | tracker | watchlist | settings

  // Media Mode State: 'movie' | 'tv' (persisted in localStorage, synchronizes entire application)
  const [activeMediaType, setActiveMediaType] = useState(() => {
    try {
      return localStorage.getItem('flicksieve_active_media_type') || 'movie';
    } catch (e) {
      return 'movie';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('flicksieve_active_media_type', activeMediaType);
    } catch (e) {
      // localStorage unavailable — media type simply won't persist
    }
  }, [activeMediaType]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All'); // All | Tamil | English | Malayalam | Hindi | Other
  const [selectedPlatform, setSelectedPlatform] = useState('All'); // All | platform_name
  const [minSieveScore, setMinSieveScore] = useState(3.0); // Filter out shows <= 3.0 out of 5
  const [includeUnrated, setIncludeUnrated] = useState(true); // Allow shows with no ratings to bypass sieve

  // Add / Delete Title Modal State
  const [showAddTitleModal, setShowAddTitleModal] = useState(false);
  const [showToDelete, setShowToDelete] = useState(null);

  // Live mirror of `shows` for callbacks that must read it without depending on it
  const showsRef = useRef(shows);
  useEffect(() => { showsRef.current = shows; }, [shows]);

  // --- HANDLERS ---
  const handleToggleWatchlist = useCallback((show) => {
    setWatchlist(prev => {
      const exists = prev.some(item => item.id === show.id);
      if (exists) {
        triggerToast(`Removed "${show.title}" from watchlist.`);
        return prev.filter(item => item.id !== show.id);
      }
      triggerToast(`Added "${show.title}" to watchlist!`);
      return [...prev, show];
    });
  }, [triggerToast]);

  const handleRemoveFromWatchlist = useCallback((showId) => {
    setWatchlist(prev => prev.filter(item => item.id !== showId));
  }, []);

  const handleUpdateWatchlistShow = useCallback((updatedShow) => {
    setWatchlist(prev => prev.map(item => item.id === updatedShow.id ? updatedShow : item));
  }, []);

  const handleAddToHistory = useCallback((logEntry) => {
    setWatchedHistory(prev => [logEntry, ...prev]);
    triggerToast(`Logged "${logEntry.title}" into watched history!`);
  }, [triggerToast]);

  const handleRemoveFromHistory = useCallback((logId) => {
    setWatchedHistory(prev => prev.filter(item => item.logId !== logId));
    triggerToast(`Deleted log entry.`);
  }, [triggerToast]);

  // Settings modification handlers
  const handleAddReviewer = useCallback((newReviewer) => {
    setReviewers(prev => [...prev, newReviewer]);
    triggerToast(`Added reviewer "${newReviewer.name}"`);
  }, [triggerToast]);

  const handleDeleteReviewer = useCallback((reviewerId) => {
    setReviewers(prev => {
      const rev = prev.find(r => r.id === reviewerId);
      triggerToast(`Deleted reviewer "${rev?.name}"`);
      return prev.filter(r => r.id !== reviewerId);
    });
  }, [triggerToast]);

  const handleUpdateReviewer = useCallback((updatedReviewer) => {
    setReviewers(prev => prev.map(r => r.id === updatedReviewer.id ? updatedReviewer : r));
  }, []);

  const handleAddShow = useCallback((newShow) => {
    const score = calculateSieveScore(newShow);
    setShows(prev => [newShow, ...prev]);

    // Switch media mode so the new title is immediately visible
    if (newShow.type && newShow.type !== activeMediaType) {
      setActiveMediaType(newShow.type);
    }

    if (score <= minSieveScore) {
      triggerToast(`Added "${newShow.title}". Note: Rating is ${score.toFixed(1)}/5, it will be sieved (filtered) from your active recommendations!`, 'error');
    } else {
      triggerToast(`Successfully added "${newShow.title}" to recommendations!`);
    }
  }, [activeMediaType, minSieveScore, triggerToast]);

  const handleDeleteShow = useCallback((showId) => {
    const show = showsRef.current.find(s => s.id === showId);
    if (show) setShowToDelete(show);
  }, []);

  const handleConfirmDelete = () => {
    if (!showToDelete) return;
    setShows(prev => prev.filter(s => s.id !== showToDelete.id));
    setWatchlist(prev => prev.filter(item => item.id !== showToDelete.id));
    triggerToast(`Deleted "${showToDelete.title}" from the database.`, 'success');
    setShowToDelete(null);
  };

  const handleRefreshShowRatings = useCallback(async (showId, triggerNotification = true) => {
    const show = showsRef.current.find(s => s.id === showId);
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
      let currentSeasons = show.seasons || null;
      let currentTotalSeasons = show.totalSeasons || null;
      const isTv = show.type === 'tv';

      const [imdbResult, lbResult, rtResult] = await Promise.allSettled([
        fetchImdbDetails(currentImdbId, show.title, currentYear),
        fetchLetterboxd(show.title, currentYear, currentImdbId, isTv),
        fetchRottenTomatoes(show.title, currentYear, isTv)
      ]);

      if (imdbResult.status === 'fulfilled' && imdbResult.value) {
        const imdbData = imdbResult.value;
        if (imdbData.imdbId) currentImdbId = imdbData.imdbId;
        if (imdbData.rating !== null && imdbData.rating !== undefined) {
          updatedRatings.imdb = imdbData.rating;
        }
        if (imdbData.overview && (!currentOverview || currentOverview === 'No overview available.')) {
          currentOverview = imdbData.overview;
        }
        if (imdbData.posterUrl && !currentPosterUrl) {
          currentPosterUrl = imdbData.posterUrl;
        }
        if (imdbData.genres && imdbData.genres.length > 0 && (!currentGenres || currentGenres.length === 0)) {
          currentGenres = imdbData.genres;
        }
        if (imdbData.year && !currentYear) {
          currentYear = imdbData.year;
        }
        if (imdbData.totalSeasons && !currentTotalSeasons) {
          currentTotalSeasons = parseInt(imdbData.totalSeasons, 10);
        }
      }

      if (lbResult.status === 'fulfilled' && lbResult.value && !lbResult.value.error) {
        const lbData = lbResult.value;
        if (lbData.rating) {
          updatedRatings.letterboxd = parseFloat(lbData.rating);
        }
        if (lbData.slug) {
          currentSlug = lbData.slug;
        }
        if (lbData.description && (!currentOverview || currentOverview === 'No overview available.')) {
          currentOverview = lbData.description;
        }
        if (lbData.poster && !currentPosterUrl) {
          currentPosterUrl = lbData.poster;
        }
        if (lbData.genres && lbData.genres.length > 0 && (!currentGenres || currentGenres.length === 0)) {
          currentGenres = lbData.genres;
        }
        if (lbData.imdb_id && !currentImdbId) {
          currentImdbId = lbData.imdb_id;
        }
      }

      if (rtResult.status === 'fulfilled' && rtResult.value && !rtResult.value.error) {
        const rtData = rtResult.value;
        if (rtData.criticScore !== undefined && rtData.criticScore !== null) {
          updatedRatings.rottenTomatoes = parseInt(rtData.criticScore, 10);
        }
        if (rtData.audienceScore !== undefined && rtData.audienceScore !== null) {
          updatedRatings.rottenTomatoesAudience = parseInt(rtData.audienceScore, 10);
        }
        if (rtData.url) {
          currentRtUrl = rtData.url;
        }
        if (rtData.seasons && rtData.seasons.length > 0) {
          currentSeasons = rtData.seasons;
          if (!currentTotalSeasons) {
            currentTotalSeasons = rtData.seasons.length;
          }
        }
      }

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
            rottenTomatoesUrl: currentRtUrl,
            seasons: currentSeasons,
            totalSeasons: currentTotalSeasons
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
  }, [triggerToast]);

  const handleImportNewShows = useCallback((newShows) => {
    const stamp = Date.now();
    const showsToImport = newShows.map((show, i) => ({
      ...show,
      id: `imported-${stamp}-${i}-${Math.random().toString(36).slice(2, 11)}`,
      featured: false
    }));

    setShows(prev => [...showsToImport, ...prev]);
    triggerToast(`Imported ${showsToImport.length} shows!`, 'success');

    // Background resolver: fetch details for each imported show, then flush
    // every resolved patch back into state in ONE setShows call.
    (async () => {
      const settled = await Promise.allSettled(showsToImport.map(async (importedShow) => {
        let currentImdbId = importedShow.imdbId || null;
        let currentImdbRating = importedShow.ratings?.imdb || null;
        let currentPosterUrl = importedShow.posterUrl || null;
        let currentOverview = importedShow.overview || '';
        let currentGenres = importedShow.genres || [];
        let currentYear = importedShow.year || null;
        const isTv = importedShow.type === 'tv';
        let currentTotalSeasons = importedShow.totalSeasons || null;

        try {
          const imdbData = await fetchImdbDetails(currentImdbId, importedShow.title, importedShow.year);
          if (imdbData) {
            if (imdbData.imdbId) currentImdbId = imdbData.imdbId;
            if (imdbData.rating) currentImdbRating = imdbData.rating;
            if (imdbData.overview) currentOverview = imdbData.overview;
            if (imdbData.posterUrl) currentPosterUrl = imdbData.posterUrl;
            if (imdbData.genres && imdbData.genres.length > 0) currentGenres = imdbData.genres;
            if (imdbData.year) currentYear = imdbData.year;
            if (imdbData.totalSeasons && !currentTotalSeasons) currentTotalSeasons = parseInt(imdbData.totalSeasons, 10);
          }
        } catch (e) {
          console.error(`Error background-resolving IMDb for ${importedShow.title}:`, e);
        }

        let lbRating = null;
        let lbSlug = null;
        let lbPoster = null;
        try {
          const lbData = await fetchLetterboxd(importedShow.title, currentYear, currentImdbId, isTv);
          if (lbData && !lbData.error) {
            lbRating = lbData.rating ? parseFloat(lbData.rating) : null;
            lbSlug = lbData.slug || null;
            lbPoster = lbData.poster || null;
          }
        } catch (err) {
          console.error(`Error background-resolving Letterboxd for ${importedShow.title}:`, err);
        }

        let rtCritic = importedShow.ratings?.rottenTomatoes || null;
        let rtAudience = importedShow.ratings?.rottenTomatoesAudience || null;
        let rtUrl = importedShow.rottenTomatoesUrl || null;
        let rtSeasons = importedShow.seasons || null;
        try {
          const rtData = await fetchRottenTomatoes(importedShow.title, currentYear, isTv);
          if (rtData && !rtData.error) {
            if (rtData.criticScore !== undefined && rtData.criticScore !== null) rtCritic = parseInt(rtData.criticScore, 10);
            if (rtData.audienceScore !== undefined && rtData.audienceScore !== null) rtAudience = parseInt(rtData.audienceScore, 10);
            if (rtData.url) rtUrl = rtData.url;
            if (rtData.seasons && rtData.seasons.length > 0) {
              rtSeasons = rtData.seasons;
              if (!currentTotalSeasons) currentTotalSeasons = rtData.seasons.length;
            }
          }
        } catch (err) {
          console.error(`Error background-resolving RT for ${importedShow.title}:`, err);
        }

        return {
          id: importedShow.id,
          currentImdbId, currentImdbRating, currentPosterUrl, currentOverview,
          currentGenres, currentYear, currentTotalSeasons,
          lbRating, lbSlug, lbPoster, rtCritic, rtAudience, rtUrl, rtSeasons
        };
      }));

      const patches = new Map();
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) patches.set(r.value.id, r.value);
      }
      if (patches.size === 0) return;

      setShows(prev => prev.map(s => {
        const p = patches.get(s.id);
        if (!p) return s;
        return {
          ...s,
          imdbId: p.currentImdbId || s.imdbId,
          posterUrl: p.currentPosterUrl || p.lbPoster || s.posterUrl || null,
          overview: p.currentOverview || s.overview,
          genres: p.currentGenres.length > 0 ? p.currentGenres : s.genres,
          year: p.currentYear || s.year,
          totalSeasons: p.currentTotalSeasons || s.totalSeasons || null,
          seasons: p.rtSeasons || s.seasons || null,
          ratings: {
            ...s.ratings,
            imdb: p.currentImdbRating || s.ratings.imdb,
            letterboxd: p.lbRating || s.ratings.letterboxd,
            rottenTomatoes: p.rtCritic !== null ? p.rtCritic : s.ratings.rottenTomatoes,
            rottenTomatoesAudience: p.rtAudience !== null ? p.rtAudience : s.ratings.rottenTomatoesAudience
          },
          letterboxdSlug: p.lbSlug || s.letterboxdSlug || null,
          rottenTomatoesUrl: p.rtUrl || s.rottenTomatoesUrl || null
        };
      }));
    })();
  }, [triggerToast]);

  const handleResetAllData = () => {
    setShows(initialShows);
    setReviewers(migrateReviewers(initialReviewers));
    setWatchlist([]);
    setWatchedHistory([]);
    triggerToast(`All application data has been reset to defaults.`, 'success');
  };

  const handleImportData = (imported) => {
    const isArr = Array.isArray;
    let applied = false;
    if (imported && isArr(imported.shows)) { setShows(imported.shows); applied = true; }
    if (imported && isArr(imported.reviewers)) { setReviewers(migrateReviewers(imported.reviewers)); applied = true; }
    if (imported && isArr(imported.watchlist)) { setWatchlist(imported.watchlist); applied = true; }
    if (imported && isArr(imported.watchedHistory)) { setWatchedHistory(imported.watchedHistory); applied = true; }
    if (!applied) {
      triggerToast('Import failed: unrecognised file', 'error');
      return;
    }
    triggerToast('Data imported successfully.', 'success');
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

  // Filter shows by active media mode (movie vs tv)
  const currentMediaShows = useMemo(() => {
    return shows.filter(s => (s.type || 'movie') === activeMediaType);
  }, [shows, activeMediaType]);

  const totalShowsInDb = currentMediaShows.length;

  // Single pass: partition current-media shows into { passed, sieved } using the
  // exact same rules, then apply search / platform / language to both sides.
  const { passed, sieved } = useMemo(() => {
    const term = searchTerm.toLowerCase();

    const matchesFilters = (show) => {
      if (searchTerm &&
          !show.title.toLowerCase().includes(term) &&
          !show.genres.some(g => g.toLowerCase().includes(term))) {
        return false;
      }
      if (selectedPlatform !== 'All' && show.platform !== selectedPlatform) {
        return false;
      }
      if (selectedLanguage !== 'All') {
        if (selectedLanguage === 'Other') {
          return !['tamil', 'english', 'malayalam', 'hindi'].includes(show.language.toLowerCase());
        }
        return show.language.toLowerCase() === selectedLanguage.toLowerCase();
      }
      return true;
    };

    const passedList = [];
    const sievedList = [];

    for (const show of currentMediaShows) {
      // A title-search match bypasses the sieve threshold entirely.
      const titleMatchesSearch = searchTerm && show.title.toLowerCase().includes(term);
      const score = calculateSieveScore(show);
      const unrated = isUnrated(show);

      let sievedOut = false;
      if (!titleMatchesSearch) {
        if (unrated) {
          if (!includeUnrated) sievedOut = true;
        } else if (score <= minSieveScore) {
          sievedOut = true;
        }
      }

      if (!matchesFilters(show)) continue;
      (sievedOut ? sievedList : passedList).push(show);
    }

    return { passed: passedList, sieved: sievedList };
  }, [currentMediaShows, searchTerm, selectedLanguage, selectedPlatform, minSieveScore, includeUnrated]);

  const sievedShows = passed;
  const sievedOutShows = sieved;

  // How many titles are sieved out on rating grounds alone (ignores text filters).
  const sievedOutCount = useMemo(() => {
    return currentMediaShows.filter(show => {
      if (includeUnrated && isUnrated(show)) return false;
      return calculateSieveScore(show) <= minSieveScore;
    }).length;
  }, [currentMediaShows, minSieveScore, includeUnrated]);

  const uniquePlatforms = useMemo(() => {
    const list = new Set();
    currentMediaShows.forEach(s => {
      if (s.platform) list.add(s.platform);
    });
    return Array.from(list);
  }, [currentMediaShows]);

  // Stable membership lookup so filter keystrokes don't rebuild every card's props
  const watchlistIds = useMemo(() => new Set(watchlist.map(w => w.id)), [watchlist]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedLanguage('All');
    setSelectedPlatform('All');
    setMinSieveScore(3.0);
    setIncludeUnrated(true);
  }, []);

  const isGridTab = activeTab === 'recommendations' || activeTab === 'sieved_out';

  const filterBarProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    selectedLanguage,
    onLanguageChange: setSelectedLanguage,
    selectedPlatform,
    onPlatformChange: setSelectedPlatform,
    uniquePlatforms,
    minSieveScore,
    onMinSieveScoreChange: setMinSieveScore,
    includeUnrated,
    onIncludeUnratedChange: setIncludeUnrated,
  };

  const gridHandlerProps = {
    watchlistIds,
    onToggleWatchlist: handleToggleWatchlist,
    onDeleteShow: handleDeleteShow,
    onRefreshShowRatings: handleRefreshShowRatings,
    reviewers,
    minSieveScore,
    includeUnrated,
  };

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <a href="#" className="logo-container" onClick={() => setActiveTab('recommendations')}>
          <span className="logo-icon">🍿</span>
          <span className="logo-text">FlickSieve</span>
        </a>

        {/* Media Mode Switcher */}
        <div className="media-mode-switcher">
          <button
            id="media-mode-movie-btn"
            className={`media-mode-btn ${activeMediaType === 'movie' ? 'active' : ''}`}
            onClick={() => setActiveMediaType('movie')}
            type="button"
          >
            <span className="media-mode-btn-icon">🎬</span>
            <span>Movies</span>
          </button>
          <button
            id="media-mode-tv-btn"
            className={`media-mode-btn ${activeMediaType === 'tv' ? 'active' : ''}`}
            onClick={() => setActiveMediaType('tv')}
            type="button"
          >
            <span className="media-mode-btn-icon">📺</span>
            <span>TV Shows</span>
          </button>
        </div>

        <nav>
          <ul className="nav-menu">
            <li>
              <button
                id="nav-btn-feed"
                className={`nav-item ${activeTab === 'recommendations' ? 'active' : ''}`}
                onClick={() => setActiveTab('recommendations')}
              >
                <Sparkles />
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
                id="nav-btn-tracker"
                className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`}
                onClick={() => setActiveTab('tracker')}
              >
                <Compass />
                Discover
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
        {isLoadingData ? (
          <div className="empty-state" style={{ marginTop: '4rem' }}>
            <div className="empty-icon">🍿</div>
            <h3>Loading FlickSieve…</h3>
            <p>Reading your saved titles, reviewers and watchlist.</p>
          </div>
        ) : (
          <>
            {/* HEADER BAR */}
            <header className="content-header">
              <div className="header-title-container">
                {activeTab === 'recommendations' && (
                  <>
                    <h1>{activeMediaType === 'tv' ? 'Sieved TV Recommendations' : 'Sieved Movie Recommendations'}</h1>
                    <p className="header-subtitle">
                      {activeMediaType === 'tv'
                        ? `Aggregating IMDb, RT Audience, and RT Critics (with season breakdown). Only ratings > ${minSieveScore}/5 shown.`
                        : `Aggregating IMDb, Rotten Tomatoes, and Letterboxd. Only ratings > ${minSieveScore}/5 shown.`}
                    </p>
                  </>
                )}
                {activeTab === 'sieved_out' && (
                  <>
                    <h1>{activeMediaType === 'tv' ? 'Sieved Out TV Shows' : 'Sieved Out Movies'}</h1>
                    <p className="header-subtitle">
                      {activeMediaType === 'tv' ? 'TV shows' : 'Movies'} with average ratings below your sieve limit ({minSieveScore}/5) or unrated titles.
                    </p>
                  </>
                )}
                {activeTab === 'wheel' && (
                  <>
                    <h1>Decision Paralysis Solver</h1>
                    <p className="header-subtitle">
                      {activeMediaType === 'tv'
                        ? "Can't decide which TV series to binge next? Let the FlickSieve wheel do it."
                        : "Can't decide what movie to watch? Let the FlickSieve wheel do it."}
                    </p>
                  </>
                )}
                {activeTab === 'tracker' && (
                  <>
                    <h1>Discover</h1>
                    <p className="header-subtitle">
                      {activeMediaType === 'tv'
                        ? 'Weekly streaming season premieres and popular new TV series.'
                        : 'Weekly digital premieres and streaming updates.'}
                    </p>
                  </>
                )}
                {activeTab === 'watchlist' && (
                  <>
                    <h1>Your Watch Queue</h1>
                    <p className="header-subtitle">
                      {activeMediaType === 'tv'
                        ? 'Track episode & season progress and log completed series or seasons.'
                        : 'Keep track of what to watch and write logs for completed titles.'}
                    </p>
                  </>
                )}
                {activeTab === 'settings' && (
                  <>
                    <h1>Application Configuration</h1>
                    <p className="header-subtitle">Customize YouTube reviewers, manage database titles, and export backups.</p>
                  </>
                )}
              </div>

              {/* QUICK DASHBOARD SUMMARY METRICS — grid tabs only */}
              {isGridTab && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div
                    className={`rating-item rating-clickable ${activeTab === 'recommendations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recommendations')}
                    style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'row', gap: '0.75rem', alignItems: 'center' }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <span className="rating-source-label" style={{ fontSize: '0.6rem' }}>
                        {activeMediaType === 'tv' ? 'TV in DB' : 'Movies in DB'}
                      </span>
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
              )}
            </header>

            {/* --- VIEW ROUTER --- */}

            {activeTab === 'recommendations' && (
              <div>
                <FilterBar {...filterBarProps} searchPlaceholder="Search by title, genre..." />
                <ShowGrid
                  {...gridHandlerProps}
                  shows={sievedShows}
                  emptyIcon="🕳️"
                  emptyTitle="All Content Sieved Out"
                  emptyText={`Everything in this filter subset fell below your minimum sieve threshold of ${minSieveScore}/5, or no titles match the query.`}
                  onClearFilters={clearFilters}
                />
              </div>
            )}

            {activeTab === 'sieved_out' && (
              <div>
                <FilterBar {...filterBarProps} searchPlaceholder="Search sieved out titles, genre..." />
                <ShowGrid
                  {...gridHandlerProps}
                  shows={sievedOutShows}
                  emptyIcon="✨"
                  emptyTitle="No Sieved Out Titles"
                  emptyText={`No titles in this filter subset fell below your minimum sieve threshold of ${minSieveScore}/5.`}
                  onClearFilters={clearFilters}
                />
              </div>
            )}

            {activeTab === 'wheel' && (
              <DeciderWheel
                matchingShows={sievedShows}
                onToggleWatchlist={handleToggleWatchlist}
                watchlist={watchlist}
              />
            )}

            {activeTab === 'tracker' && (
              <OttTracker
                shows={shows}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                reviewers={reviewers}
                onImportNewShows={handleImportNewShows}
                mediaType={activeMediaType}
              />
            )}

            {activeTab === 'watchlist' && (
              <Watchlist
                watchlist={watchlist}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
                watchedHistory={watchedHistory}
                onAddToHistory={handleAddToHistory}
                onRemoveFromHistory={handleRemoveFromHistory}
                onUpdateWatchlistShow={handleUpdateWatchlistShow}
                mediaType={activeMediaType}
              />
            )}

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
          </>
        )}
      </main>

      {/* ADD TITLE MODAL */}
      <AddTitleModal
        isOpen={showAddTitleModal}
        onClose={() => setShowAddTitleModal(false)}
        onAddShow={handleAddShow}
        defaultType={activeMediaType}
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
    </div>
  );
}
