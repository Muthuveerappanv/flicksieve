import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { scoreImdbMatch } from './imdbMatch.js';

export const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

/**
 * Fetches Letterboxd rating details.
 */
export async function fetchLetterboxd(title, year = '', imdbId = '', isTv = false) {
  if (isTauri()) {
    const resultJson = await invoke('run_letterboxd_scraper', {
      query: title,
      year: year ? String(year) : 'None',
      imdbId: imdbId ? String(imdbId) : 'None',
      isTv,
    });
    return JSON.parse(resultJson);
  } else {
    const yearParam = year ? `&year=${year}` : '';
    const imdbParam = imdbId ? `&imdb_id=${imdbId}` : '';
    const isTvParam = `&is_tv=${isTv ? 'true' : 'false'}`;
    const res = await fetch(`/api/letterboxd?query=${encodeURIComponent(title)}` + yearParam + imdbParam + isTvParam);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  }
}

/**
 * Fetches Rotten Tomatoes rating details.
 */
export async function fetchRottenTomatoes(title, year = '', isTv = false) {
  if (isTauri()) {
    const resultJson = await invoke('run_rottentomatoes_scraper', {
      query: title,
      year: year ? String(year) : 'None',
      isTv,
    });
    return JSON.parse(resultJson);
  } else {
    const yearParam = year ? `&year=${year}` : '';
    const isTvParam = `&is_tv=${isTv ? 'true' : 'false'}`;
    const res = await fetch(`/api/rottentomatoes?query=${encodeURIComponent(title)}` + yearParam + isTvParam);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  }
}

/**
 * Discovers new titles from Rotten Tomatoes with a strong audience score.
 * Crawls RT's "Movies at Home" or "TV Series" listing back `days` days and keeps titles with
 * audience score >= `minAudience`. Returns { count, windowDays, minAudience, pagesCrawled, movies: [...], shows: [...] }.
 */
export async function fetchDiscoverAtHome(days = 90, minAudience = 70, sort = 'audience', mediaType = 'movie') {
  const sortParam = sort === 'date' ? 'date' : 'audience';
  if (isTauri()) {
    const resultJson = await invoke('run_discover_at_home', {
      days: String(days),
      minAudience: minAudience ? String(minAudience) : 'None',
      sort: sortParam,
      mediaType,
    });
    return JSON.parse(resultJson);
  } else {
    const params = new URLSearchParams();
    params.set('days', days);
    if (minAudience) params.set('min_audience', minAudience);
    params.set('sort', sortParam);
    params.set('media_type', mediaType);
    const res = await fetch(`/api/discover-at-home?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  }
}

/**
 * Discovers Indian films from handpicked, credible critic websites.
 *
 * Critic star ratings (bylined professionals) drive the ranking. IMDb and
 * Letterboxd remain display-only and never rank or filter. YouTube reviewers
 * are an optional supplement, off by default.
 */
export async function fetchDiscoverIndian({
  windowDays = 90,
  languages = [],
  minRating = null,
  minCritics = 1,
  includeYoutube = false,
} = {}) {
  const langParam = Array.isArray(languages) ? languages.join(',') : String(languages || '');
  const ratingParam = minRating === null || minRating === '' ? '' : String(minRating);

  if (isTauri()) {
    const resultJson = await invoke('run_discover_indian', {
      windowDays: String(windowDays),
      languages: langParam,
      minRating: ratingParam,
      minCritics: String(minCritics),
      includeYoutube: String(includeYoutube),
    });
    return JSON.parse(resultJson);
  }

  const params = new URLSearchParams({
    window_days: String(windowDays),
    languages: langParam,
    min_rating: ratingParam,
    min_critics: String(minCritics),
    include_youtube: String(includeYoutube),
  });
  const res = await fetch(`/api/discover-indian?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return await res.json();
}

/**
 * Searches IMDb for titles using IMDb's high-speed suggestion API.
 */
export async function searchImdb(query) {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const firstChar = cleanQuery.charAt(0) || 'a';
  try {
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleanQuery)}.json`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !data.d) return [];
    return data.d
      .filter(item => item.id && item.id.startsWith('tt'))
      .map(item => ({
        id: item.id,
        primaryTitle: item.l || '',
        title: item.l || '',
        startYear: item.y || (item.yr ? parseInt(item.yr.split('-')[0], 10) : null),
        year: item.y || (item.yr ? parseInt(item.yr.split('-')[0], 10) : null),
        type: item.qid === 'tvSeries' || item.qid === 'tvMiniSeries' ? 'tvSeries' : 'movie',
        primaryImage: item.i ? { url: item.i.imageUrl } : null,
        posterUrl: item.i ? item.i.imageUrl : null,
        actors: item.s || '',
      }));
  } catch (e) {
    console.error('Error querying IMDb suggestions:', e);
    return [];
  }
}
function formatOmdbData(data, resolvedImdbId, title, year) {
  let ratingNum = null;
  if (data.imdbRating && data.imdbRating !== 'N/A') {
    const parsed = parseFloat(data.imdbRating);
    if (!isNaN(parsed)) ratingNum = parsed;
  }

  return {
    imdbId: data.imdbID || resolvedImdbId || null,
    title: data.Title || title,
    type: data.Type === 'series' ? 'tv' : 'movie',
    totalSeasons: data.totalSeasons ? parseInt(data.totalSeasons, 10) : null,
    yearSpan: data.Year || null,
    year: data.Year ? parseInt(data.Year, 10) : (year ? parseInt(year, 10) : null),
    rating: ratingNum,
    overview: data.Plot && data.Plot !== 'N/A' ? data.Plot : '',
    genres: data.Genre && data.Genre !== 'N/A' ? data.Genre.split(',').map(g => g.trim()) : [],
    language: data.Language && data.Language !== 'N/A' ? data.Language.split(',')[0].trim() : '',
    posterUrl: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
    releaseDate: data.Released && data.Released !== 'N/A' ? data.Released : null,
    actors: data.Actors && data.Actors !== 'N/A' ? data.Actors : '',
    director: data.Director && data.Director !== 'N/A' ? data.Director : '',
    ratings: data.Ratings || []
  };
}

/**
 * Scrapes live real-time IMDb rating directly from IMDb title page.
 */
export async function fetchLiveImdbRating(imdbId) {
  if (!imdbId || !imdbId.startsWith('tt')) return null;
  try {
    const res = await fetch(`https://r.jina.ai/https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`);
    if (!res.ok) return null;
    const text = await res.text();

    let rating = null;
    const titleLineMatch = text.match(/Title:\s*(.*?)\n/);
    if (titleLineMatch) {
      const starMatch = titleLineMatch[1].match(/⭐\s*([0-9\.]+)/);
      if (starMatch) rating = parseFloat(starMatch[1]);
    }
    if (!rating) {
      const generalStarMatch = text.match(/⭐\s*([0-9\.]+)/);
      if (generalStarMatch) rating = parseFloat(generalStarMatch[1]);
    }

    let genres = [];
    if (titleLineMatch && titleLineMatch[1].includes('|')) {
      const parts = titleLineMatch[1].split('|');
      if (parts[1]) {
        genres = parts[1].split(',').map(g => g.trim()).filter(Boolean);
      }
    }

    return { rating, genres };
  } catch (e) {
    console.error('Error fetching live IMDb rating:', e);
    return null;
  }
}

/**
 * Fetches full IMDb & movie metadata (including live IMDb rating, plot, genres, language, release date).
 * Queries live IMDb directly for real-time rating accuracy, enriched with OMDb metadata.
 */
export async function fetchImdbDetails(imdbId, title = '', year = '', apiKey = '') {
  const key = apiKey || 'trilogy';
  try {
    let resolvedImdbId = imdbId;

    // If imdbId is not provided or not valid 'tt...', resolve it using searchImdb first
    if (!resolvedImdbId || !resolvedImdbId.startsWith('tt')) {
      if (title) {
        const matches = await searchImdb(title);
        if (matches && matches.length > 0) {
          const cleanTitle = title.trim().toLowerCase();
          const targetYear = year ? parseInt(year, 10) : null;
          const bestMatch = matches.find(m => 
            m.primaryTitle.toLowerCase() === cleanTitle &&
            (!targetYear || !m.startYear || Math.abs(m.startYear - targetYear) <= 1)
          ) || matches[0];
          if (bestMatch && bestMatch.id) {
            resolvedImdbId = bestMatch.id;
          }
        }
      }
    }

    // Run live IMDb scraper and OMDb fetcher in parallel
    const [liveResult, omdbResult] = await Promise.allSettled([
      resolvedImdbId ? fetchLiveImdbRating(resolvedImdbId) : Promise.resolve(null),
      (async () => {
        let url = '';
        if (resolvedImdbId && resolvedImdbId.startsWith('tt')) {
          url = `https://www.omdbapi.com/?i=${encodeURIComponent(resolvedImdbId)}&apikey=${key}`;
        } else if (title) {
          const yearParam = year ? `&y=${encodeURIComponent(year)}` : '';
          url = `https://www.omdbapi.com/?t=${encodeURIComponent(title.trim())}${yearParam}&apikey=${key}`;
        } else {
          return null;
        }

        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.Response === 'False') {
          if (year && title) {
            const fallbackRes = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title.trim())}&apikey=${key}`);
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData.Response !== 'False') {
                return formatOmdbData(fallbackData, resolvedImdbId, title, year);
              }
            }
          }
          return null;
        }
        return formatOmdbData(data, resolvedImdbId, title, year);
      })()
    ]);

    const liveData = liveResult.status === 'fulfilled' ? liveResult.value : null;
    const omdbData = omdbResult.status === 'fulfilled' ? omdbResult.value : null;

    if (!liveData && !omdbData) return null;

    const finalResult = omdbData || {
      imdbId: resolvedImdbId,
      title,
      type: 'movie',
      totalSeasons: null,
      yearSpan: null,
      year: year ? parseInt(year, 10) : null,
      rating: null,
      overview: '',
      genres: [],
      language: '',
      posterUrl: null,
      releaseDate: null,
      actors: '',
      director: '',
      ratings: []
    };

    // If live IMDb returned a real-time rating, override the cached rating
    if (liveData && liveData.rating !== null && liveData.rating !== undefined) {
      finalResult.rating = liveData.rating;
      if (liveData.genres && liveData.genres.length > 0 && (!finalResult.genres || finalResult.genres.length === 0)) {
        finalResult.genres = liveData.genres;
      }
    }

    return finalResult;
  } catch (e) {
    console.error('Error in fetchImdbDetails:', e);
    return null;
  }
}

/**
 * Scrapes 91mobiles and enriches the results.
 * In a web browser environment, we fetch from the proxy API which already does enrichment.
 * In Tauri, we invoke the python scraper locally and then perform sequential enrichment.
 */
export async function fetch91Mobiles(onProgress) {
  if (isTauri()) {
    // 1. Run local raw python scraper
    if (onProgress) onProgress(0, 0, 'Fetching raw releases from 91mobiles...');
    const resultJson = await invoke('run_91mobiles_scraper');
    const data = JSON.parse(resultJson);
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    const shows = data.shows || [];
    if (shows.length === 0) {
      return { shows: [] };
    }
    
    // 2. Resolve IMDb details sequentially client-side
    const enrichedShows = [];
    for (let i = 0; i < shows.length; i++) {
      const show = shows[i];
      if (onProgress) {
        onProgress(i + 1, shows.length, show.title);
      }
      
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        const scrapedYear = show.releaseDate ? parseInt(show.releaseDate.split('-')[0], 10) : null;
        const scrapedType = show.type; // 'movie' or 'tv'
        
        const matches = await searchImdb(show.title);
        let match = null;
        if (matches.length > 0) {
          let highestScore = -1000;
          for (const m of matches) {
            const score = scoreImdbMatch(m, { title: show.title, year: scrapedYear, type: scrapedType });
            if (score > highestScore) {
              highestScore = score;
              match = m;
            }
          }
        }
        
        if (match) {
          show.imdbId = match.id;
          show.posterUrl = match.posterUrl || show.posterUrl;
          if (match.startYear) {
            show.year = match.startYear;
          }
        }
      } catch (e) {
        console.error(`Error resolving metadata for ${show.title}:`, e.message);
      }
      enrichedShows.push(show);
    }
    
    return { shows: enrichedShows };
  } else {
    if (onProgress) onProgress(0, 0, 'Fetching weekly releases...');
    const res = await fetch('/api/scrape-91mobiles');
    return await res.json();
  }
}

/**
 * Gets the current data folder path.
 */
export async function getDataFolder() {
  if (isTauri()) {
    return await invoke('get_data_folder');
  } else {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.dataFolder;
  }
}

/**
 * Sets/updates the data folder path.
 */
export async function setDataFolder(path) {
  if (isTauri()) {
    await invoke('set_data_folder', { path });
  } else {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dataFolder: path })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  }
}

/**
 * Loads content of a data file by filename.
 */
export async function loadDataFile(filename) {
  if (isTauri()) {
    try {
      return await invoke('load_data_file', { filename });
    } catch (err) {
      if (err.includes('NOT_FOUND')) {
        return null;
      }
      throw new Error(err);
    }
  } else {
    const res = await fetch(`/api/data?file=${encodeURIComponent(filename)}`);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.text();
  }
}

/**
 * Saves content of a data file by filename.
 */
export async function saveDataFile(filename, content) {
  if (isTauri()) {
    await invoke('save_data_file', { filename, content });
  } else {
    const res = await fetch(`/api/data?file=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: content
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  }
}

/**
 * Opens a URL in the default system browser when running in Tauri,
 * or in a new window/tab when running in a web browser.
 */
export async function openExternalUrl(url) {
  if (isTauri()) {
    try {
      await openUrl(url);
    } catch (err) {
      console.error('Failed to open URL via Tauri opener plugin:', err);
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
}

