import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFile } from 'child_process'
import path from 'path'
import url from 'url'
import fs from 'fs'
import os from 'os'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function expandTilde(filepath) {
  const homedir = os.homedir();
  if (filepath.startsWith('~/')) {
    return path.join(homedir, filepath.slice(2));
  }
  if (filepath === '~') {
    return homedir;
  }
  return filepath;
}

const resolveConfigPath = () => {
  return path.join(os.homedir(), '.flicksieve', 'config.json');
};

const resolveDataFolder = () => {
  const configPath = resolveConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config && config.dataFolder) {
        return expandTilde(config.dataFolder);
      }
    } catch (err) {
      console.error('Error reading config file in Vite middleware:', err);
    }
  }
  return path.join(os.homedir(), '.flicksieve');
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'letterboxd-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const reqUrl = url.parse(req.url, true);

          if (reqUrl.pathname === '/api/config') {
            res.setHeader('Content-Type', 'application/json');
            if (req.method === 'GET') {
              const dataFolder = resolveDataFolder();
              res.end(JSON.stringify({ dataFolder }));
              return;
            } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                try {
                  const { dataFolder } = JSON.parse(body);
                  if (!dataFolder) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'dataFolder is required' }));
                    return;
                  }
                  
                  const expandedPath = expandTilde(dataFolder);
                  fs.mkdirSync(expandedPath, { recursive: true });
                  
                  const configPath = resolveConfigPath();
                  fs.mkdirSync(path.dirname(configPath), { recursive: true });
                  
                  fs.writeFileSync(configPath, JSON.stringify({ dataFolder }, null, 2), 'utf-8');
                  res.end(JSON.stringify({ success: true }));
                } catch (e) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }
          }
          
          if (reqUrl.pathname === '/api/data') {
            const filename = reqUrl.query.file;
            if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid filename' }));
              return;
            }
            
            const folder = resolveDataFolder();
            const filePath = path.join(folder, filename);
            
            if (req.method === 'GET') {
              if (!fs.existsSync(filePath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'NOT_FOUND' }));
                return;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(fs.readFileSync(filePath, 'utf-8'));
              return;
            } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                try {
                  fs.mkdirSync(folder, { recursive: true });
                  fs.writeFileSync(filePath, body, 'utf-8');
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true }));
                } catch (e) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }
          }

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

                    const cleanQuery = show.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                    const firstChar = cleanQuery.charAt(0) || 'a';
                    let searchRes = await fetch(`https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleanQuery)}.json`);
                    let matches = [];
                    if (searchRes.ok) {
                      const searchData = await searchRes.json();
                      matches = (searchData.d || [])
                        .filter(item => item.id && item.id.startsWith('tt'))
                        .map(item => ({
                          id: item.id,
                          primaryTitle: item.l || '',
                          title: item.l || '',
                          startYear: item.y || (item.yr ? parseInt(item.yr.split('-')[0], 10) : null),
                          type: item.qid === 'tvSeries' || item.qid === 'tvMiniSeries' ? 'tvSeries' : 'movie',
                          posterUrl: item.i ? item.i.imageUrl : null,
                        }));
                    }

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
