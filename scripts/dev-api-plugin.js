import { execFile } from 'child_process';
import path from 'path';
import url from 'url';
import fs from 'fs';
import os from 'os';

import { scoreImdbMatch } from '../src/utils/imdbMatch.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

/**
 * Path to the project's virtualenv Python interpreter, platform-aware.
 * Mirrors scripts/setup_python.js which creates `.venv\Scripts\` on Windows
 * and `.venv/bin/` everywhere else.
 */
export function venvPython() {
  return process.platform === 'win32'
    ? path.join(rootDir, '.venv', 'Scripts', 'python.exe')
    : path.join(rootDir, '.venv', 'bin', 'python3');
}

function scriptPath(name) {
  return path.join(rootDir, 'scripts', name);
}

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

/**
 * Vite dev-server plugin exposing the local `/api/*` routes that proxy the
 * Python scrapers and read/write the user's data folder. Only active in `vite`
 * / `vite dev`; the packaged Tauri app serves the same routes natively.
 */
export function devApiPlugin() {
  return {
    name: 'flicksieve-dev-api',
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
          const isTv = reqUrl.query.is_tv || 'false';

          if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing query parameter' }));
            return;
          }

          execFile(venvPython(), [scriptPath('fetch_letterboxd.py'), query, year, imdbId, isTv], (err, stdout, stderr) => {
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

          execFile(venvPython(), [scriptPath('fetch_rottentomatoes.py'), query, year, isTv], (err, stdout, stderr) => {
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

        if (reqUrl.pathname === '/api/discover-at-home') {
          const days = reqUrl.query.days || 'None';
          const minAudience = reqUrl.query.min_audience || 'None';
          const sort = reqUrl.query.sort || 'None';
          const mediaType = reqUrl.query.media_type || 'movie';

          execFile(venvPython(), [scriptPath('discover_at_home.py'), days, minAudience, sort, mediaType], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
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

        if (reqUrl.pathname === '/api/discover-indian') {
          const windowDays = reqUrl.query.window_days || '90';
          const languages = reqUrl.query.languages || '';
          const minRating = reqUrl.query.min_rating || '';
          const minCritics = reqUrl.query.min_critics || '1';
          const includeYoutube = reqUrl.query.include_youtube || 'false';

          execFile(
            venvPython(),
            [scriptPath('discover_indian.py'), windowDays, languages, minRating, minCritics, includeYoutube],
            { maxBuffer: 20 * 1024 * 1024, timeout: 300000 },
            (err, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message, stderr }));
                return;
              }
              res.end(stdout);
            }
          );
          return;
        }

        if (reqUrl.pathname === '/api/scrape-91mobiles') {
          execFile(venvPython(), [scriptPath('scrape_91mobiles.py')], async (err, stdout, stderr) => {
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
    },
  };
}
