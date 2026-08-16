import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

export const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

/**
 * Fetches Letterboxd rating details.
 */
export async function fetchLetterboxd(title, year = '', imdbId = '') {
  if (isTauri()) {
    const resultJson = await invoke('run_letterboxd_scraper', {
      query: title,
      year: year ? String(year) : 'None',
      imdbId: imdbId ? String(imdbId) : 'None',
    });
    return JSON.parse(resultJson);
  } else {
    const yearParam = year ? `&year=${year}` : '';
    const imdbParam = imdbId ? `&imdb_id=${imdbId}` : '';
    const res = await fetch(`/api/letterboxd?query=${encodeURIComponent(title)}` + yearParam + imdbParam);
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
            let score = 0;
            const titleEqual = m.primaryTitle.toLowerCase() === show.title.toLowerCase();
            const titleContains = m.primaryTitle.toLowerCase().includes(show.title.toLowerCase()) || 
                                  show.title.toLowerCase().includes(m.primaryTitle.toLowerCase());
            if (titleEqual) score += 100;
            else if (titleContains) score += 30;
            
            if (scrapedYear && m.startYear) {
              const yearDiff = Math.abs(m.startYear - scrapedYear);
              if (yearDiff === 0) score += 50;
              else if (yearDiff === 1) score += 20;
              else if (yearDiff > 2) score -= 40;
            }
            
            if (scrapedType === 'tv') {
              if (m.type === 'tvSeries') score += 30;
              else score -= 30;
            } else {
              if (m.type === 'movie') score += 30;
              else score -= 30;
            }
            
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

