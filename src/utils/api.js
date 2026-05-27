import { invoke } from '@tauri-apps/api/core';

const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

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
    
    // 2. Resolve IMDb details sequentially client-side to prevent Cloudflare rate limits
    const enrichedShows = [];
    for (let i = 0; i < shows.length; i++) {
      const show = shows[i];
      if (onProgress) {
        onProgress(i + 1, shows.length, show.title);
      }
      
      try {
        // Small delay to pace requests
        await new Promise((resolve) => setTimeout(resolve, 150));
        
        const scrapedYear = show.releaseDate ? parseInt(show.releaseDate.split('-')[0], 10) : null;
        const scrapedType = show.type; // 'movie' or 'tv'
        
        // Helper to compute initial similarity score
        const getInitialScore = (m) => {
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
          return score;
        };
        
        let searchRes = await fetch(`https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(show.title)}`);
        let matches = [];
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          matches = searchData.titles || [];
        }
        
        // Fallback Search
        let highestInitialScore = matches.length > 0 ? Math.max(...matches.map((m) => getInitialScore(m))) : -1000;
        if ((matches.length === 0 || highestInitialScore < 80) && scrapedYear) {
          const fallbackQuery = `${show.title} ${scrapedYear}`;
          try {
            const fallbackRes = await fetch(`https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(fallbackQuery)}`);
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              const fallbackMatches = fallbackData.titles || [];
              if (fallbackMatches.length > 0) {
                matches = fallbackMatches;
                highestInitialScore = Math.max(...matches.map((m) => getInitialScore(m)));
              }
            }
          } catch (err) {
            console.error(`Fallback search failed for ${show.title} (${scrapedYear}):`, err.message);
          }
        }
        
        // Score refinement by fetching full details for top 3 candidates
        let match = null;
        if (matches.length > 0) {
          const candidates = matches
            .map((m) => ({ match: m, initialScore: getInitialScore(m) }))
            .sort((a, b) => b.initialScore - a.initialScore)
            .slice(0, 3);
          
          let highestFinalScore = -1000;
          
          for (const cand of candidates) {
            const m = cand.match;
            let finalScore = cand.initialScore;
            
            try {
              await new Promise((resolve) => setTimeout(resolve, 50));
              const detailRes = await fetch(`https://api.imdbapi.dev/titles/${m.id}`);
              if (detailRes.ok) {
                const details = await detailRes.json();
                m.details = details;
                
                // A. Spoken language comparison
                if (details.spokenLanguages && details.spokenLanguages.length > 0) {
                  const spokenLangs = details.spokenLanguages.map((l) => l.name.toLowerCase());
                  const scrapedLang = (show.language || '').toLowerCase();
                  if (spokenLangs.includes(scrapedLang)) {
                    finalScore += 80;
                  } else {
                    finalScore -= 40;
                  }
                }
                
                // B. Genre overlap comparison
                if (details.genres && details.genres.length > 0 && show.genres && show.genres.length > 0) {
                  const detailGenres = details.genres.map((g) => g.toLowerCase());
                  const scrapedGenres = show.genres.map((g) => g.toLowerCase());
                  const overlapCount = scrapedGenres.filter((g) => detailGenres.includes(g)).length;
                  finalScore += overlapCount * 15;
                }
                
                // C. Exact year check
                if (scrapedYear && details.startYear) {
                  if (details.startYear === scrapedYear) {
                    finalScore += 20;
                  }
                }
              }
            } catch (err) {
              console.error(`Failed to fetch details for candidate ${m.id}:`, err.message);
            }
            
            // D. Popularity boost from vote count
            if (m.rating?.voteCount) {
              finalScore += Math.min(Math.log10(m.rating.voteCount) * 2, 10);
            }
            
            if (finalScore > highestFinalScore) {
              highestFinalScore = finalScore;
              match = m;
            }
          }
        }
        
        if (match) {
          show.imdbId = match.id;
          show.ratings.imdb = match.rating?.aggregateRating || null;
          show.posterUrl = match.primaryImage?.url || null;
          
          const details = match.details;
          if (details) {
            show.overview = details.plot || '';
            if (details.genres && details.genres.length > 0) {
              show.genres = details.genres;
            }
            if (details.startYear) {
              show.year = details.startYear;
            }
            if (details.spokenLanguages && details.spokenLanguages.length > 0) {
              const mainLang = details.spokenLanguages[0].name;
              if (['tamil', 'malayalam', 'hindi', 'english'].includes(mainLang.toLowerCase())) {
                show.language = mainLang.charAt(0).toUpperCase() + mainLang.slice(1);
              } else {
                show.language = mainLang;
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error resolving IMDb metadata for ${show.title}:`, e.message);
      }
      enrichedShows.push(show);
    }
    
    return { shows: enrichedShows };
  } else {
    if (onProgress) onProgress(0, 0, 'Fetching weekly releases...');
    const res = await fetch('/api/scrape-91mobiles');
    if (!res.ok) throw new Error('Failed to fetch weekly releases from backend.');
    return await res.json();
  }
}
