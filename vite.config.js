import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFile } from 'child_process'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'letterboxd-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const reqUrl = url.parse(req.url, true);
          if (reqUrl.pathname === '/api/letterboxd') {
            const query = reqUrl.query.query;
            const year = reqUrl.query.year || '';
            const imdbId = reqUrl.query.imdb_id || '';
            
            if (!query) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing query parameter' }));
              return;
            }
            
            const pythonPath = path.join(__dirname, '.venv', 'bin', 'python3');
            const scriptPath = path.join(__dirname, 'scripts', 'fetch_letterboxd.py');
            
            execFile(pythonPath, [scriptPath, query, year, imdbId], (err, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message, stderr }));
                return;
              }
              res.end(stdout);
            });
            return;
          }
          
          if (reqUrl.pathname === '/api/rottentomatoes') {
            const query = reqUrl.query.query;
            const year = reqUrl.query.year || '';
            const isTv = reqUrl.query.is_tv || 'false';
            
            if (!query) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing query parameter' }));
              return;
            }
            
            const pythonPath = path.join(__dirname, '.venv', 'bin', 'python3');
            const scriptPath = path.join(__dirname, 'scripts', 'fetch_rottentomatoes.py');
            
            execFile(pythonPath, [scriptPath, query, year, isTv], (err, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message, stderr }));
                return;
              }
              res.end(stdout);
            });
            return;
          }
          
          if (reqUrl.pathname === '/api/scrape-91mobiles') {
            const pythonPath = path.join(__dirname, '.venv', 'bin', 'python3');
            const scriptPath = path.join(__dirname, 'scripts', 'scrape_91mobiles.py');
            
            execFile(pythonPath, [scriptPath], async (err, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message, stderr }));
                return;
              }
              
              try {
                const data = JSON.parse(stdout.trim());
                if (data.error) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: data.error }));
                  return;
                }
                
                const shows = data.shows || [];
                
                // Resolve IMDb details sequentially to prevent Cloudflare rate limits
                const enrichedShows = [];
                for (let i = 0; i < shows.length; i++) {
                  const show = shows[i];
                  try {
                    // Small delay to pace requests
                    await new Promise(resolve => setTimeout(resolve, 150));
                    
                    const scrapedYear = show.releaseDate ? parseInt(show.releaseDate.split('-')[0], 10) : null;
                    const scrapedType = show.type; // 'movie' or 'tv'

                    // Helper to compute initial similarity score based on search result metadata
                    const getInitialScore = (m) => {
                      let score = 0;
                      // 1. Title match
                      const titleEqual = m.primaryTitle.toLowerCase() === show.title.toLowerCase();
                      const titleContains = m.primaryTitle.toLowerCase().includes(show.title.toLowerCase()) || 
                                            show.title.toLowerCase().includes(m.primaryTitle.toLowerCase());
                      
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
                      return score;
                    };

                    let searchRes = await fetch(`https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(show.title)}`);
                    let matches = [];
                    if (searchRes.ok) {
                      const searchData = await searchRes.json();
                      matches = searchData.titles || [];
                    }

                    // Fallback Search: If search returns no results or only poor matches (initial score < 80)
                    let highestInitialScore = matches.length > 0 ? Math.max(...matches.map(m => getInitialScore(m))) : -1000;
                    if ((matches.length === 0 || highestInitialScore < 80) && scrapedYear) {
                      const fallbackQuery = `${show.title} ${scrapedYear}`;
                      try {
                        const fallbackRes = await fetch(`https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(fallbackQuery)}`);
                        if (fallbackRes.ok) {
                          const fallbackData = await fallbackRes.json();
                          const fallbackMatches = fallbackData.titles || [];
                          if (fallbackMatches.length > 0) {
                            // If fallback search succeeded, evaluate these matches instead
                            matches = fallbackMatches;
                            highestInitialScore = Math.max(...matches.map(m => getInitialScore(m)));
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
                        .map(m => ({ match: m, initialScore: getInitialScore(m) }))
                        .sort((a, b) => b.initialScore - a.initialScore)
                        .slice(0, 3);
                      
                      let highestFinalScore = -1000;
                      
                      for (const cand of candidates) {
                        const m = cand.match;
                        let finalScore = cand.initialScore;
                        
                        try {
                          await new Promise(resolve => setTimeout(resolve, 50)); // paced delay between detail checks
                          const detailRes = await fetch(`https://api.imdbapi.dev/titles/${m.id}`);
                          if (detailRes.ok) {
                            const details = await detailRes.json();
                            m.details = details; // save details on match object
                            
                            // A. Spoken language comparison
                            if (details.spokenLanguages && details.spokenLanguages.length > 0) {
                              const spokenLangs = details.spokenLanguages.map(l => l.name.toLowerCase());
                              const scrapedLang = (show.language || '').toLowerCase();
                              if (spokenLangs.includes(scrapedLang)) {
                                finalScore += 80;
                              } else {
                                finalScore -= 40;
                              }
                            }
                            
                            // B. Genre overlap comparison
                            if (details.genres && details.genres.length > 0 && show.genres && show.genres.length > 0) {
                              const detailGenres = details.genres.map(g => g.toLowerCase());
                              const scrapedGenres = show.genres.map(g => g.toLowerCase());
                              const overlapCount = scrapedGenres.filter(g => detailGenres.includes(g)).length;
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
                
                res.end(JSON.stringify({ shows: enrichedShows }));
              } catch (parseErr) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: parseErr.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ],
})
