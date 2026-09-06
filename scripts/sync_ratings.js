import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { venvPython } from './dev-api-plugin.js';

const execFilePromise = promisify(execFile);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const seedPath = path.join(__dirname, '..', 'src', 'data', 'shows.json');
const pythonPath = venvPython();
const letterboxdScriptPath = path.join(__dirname, 'fetch_letterboxd.py');

function expandTilde(p) {
  if (p && p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

// Resolve the live library the same way scripts/discover_at_home.js does:
// ~/.flicksieve/config.json -> dataFolder -> shows.json, falling back to the seed fixture.
function resolveLibraryPath() {
  const configPath = path.join(os.homedir(), '.flicksieve', 'config.json');
  let dataFolder = path.join(os.homedir(), '.flicksieve');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config && config.dataFolder) dataFolder = expandTilde(config.dataFolder);
    } catch (err) {
      console.error('Could not read ~/.flicksieve/config.json:', err.message);
    }
  }
  const livePath = path.join(dataFolder, 'shows.json');
  if (fs.existsSync(livePath)) return livePath;
  return seedPath;
}

const dbPath = resolveLibraryPath();

// Delay helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runLetterboxdScraper(title, year = '', imdbId = '', isTv = false) {
  try {
    const { stdout } = await execFilePromise(pythonPath, [
      letterboxdScriptPath,
      title,
      year || 'None',
      imdbId || 'None',
      isTv ? 'true' : 'false',
    ]);
    return JSON.parse(stdout.trim());
  } catch (err) {
    console.error(`  [Letterboxd error for "${title}"]:`, err.message);
    return null;
  }
}

async function syncRatings() {
  console.log("Starting IMDb and Letterboxd ratings synchronization...");
  console.log(`Library: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found at ${dbPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  console.log(`Loaded ${data.length} shows/movies from database.`);

  for (let i = 0; i < data.length; i++) {
    const show = data[i];
    console.log(`\n[${i + 1}/${data.length}] Syncing: "${show.title}" (${show.year || 'unknown year'})...`);

    let imdbId = show.imdbId || null;
    let letterboxdSlug = show.letterboxdSlug || null;

    // --- STEP 1: IMDb Search if missing ---
    try {
      if (!imdbId) {
        console.log(`  IMDb ID missing. Searching IMDb for "${show.title}"...`);
        const cleanQuery = show.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const firstChar = cleanQuery.charAt(0) || 'a';
        const searchRes = await fetch(`https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleanQuery)}.json`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const matches = (searchData.d || [])
            .filter(item => item.id && item.id.startsWith('tt'))
            .map(item => ({
              id: item.id,
              primaryTitle: item.l || '',
              startYear: item.y || null,
              posterUrl: item.i ? item.i.imageUrl : null
            }));

          const bestMatch = matches.find(m => 
            m.primaryTitle.toLowerCase() === show.title.toLowerCase() &&
            (!show.year || Math.abs(m.startYear - show.year) <= 1)
          ) || matches[0];

          if (bestMatch) {
            imdbId = bestMatch.id;
            show.imdbId = imdbId;
            if (bestMatch.posterUrl && !show.posterUrl) {
              show.posterUrl = bestMatch.posterUrl;
            }
            if (bestMatch.startYear && !show.year) {
              show.year = bestMatch.startYear;
            }
            console.log(`  Found IMDb ID: ${imdbId} (${bestMatch.primaryTitle})`);
          }
        }
      }

      if (imdbId) {
        const omdbRes = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=trilogy`);
        if (omdbRes.ok) {
          const omdbData = await omdbRes.json();
          if (omdbData.Response !== 'False') {
            if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
              const r = parseFloat(omdbData.imdbRating);
              if (!isNaN(r)) {
                show.ratings.imdb = r;
                console.log(`  Updated IMDb rating: ${r}/10`);
              }
            }
            if (!show.overview || show.overview === 'No overview available.') {
              if (omdbData.Plot && omdbData.Plot !== 'N/A') show.overview = omdbData.Plot;
            }
          }
        }
      }
    } catch (err) {
      console.error(`  [IMDb error for "${show.title}"]:`, err.message);
    }

    // --- STEP 2: Letterboxd Sync ---
    try {
      console.log(`  Querying Letterboxd for "${show.title}"...`);
      const lbData = await runLetterboxdScraper(show.title, show.year, imdbId, show.type === 'tv');
      if (lbData && !lbData.error) {
        if (lbData.rating) {
          show.ratings.letterboxd = parseFloat(lbData.rating);
          console.log(`  Updated Letterboxd rating: ${lbData.rating}/5`);
        }
        if (lbData.slug) {
          show.letterboxdSlug = lbData.slug;
          letterboxdSlug = lbData.slug;
        }
        if (lbData.poster && !show.posterUrl) {
          show.posterUrl = lbData.poster;
        }
      } else if (lbData && lbData.error) {
        console.warn(`  Letterboxd warning: ${lbData.error}`);
      }
    } catch (err) {
      console.error(`  [Letterboxd error for "${show.title}"]:`, err.message);
    }

    // Write database incrementally after each successful sync to prevent data loss
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');

    // Wait a short moment to avoid flooding the API
    await delay(1000);
  }

  console.log("\nSynchronization finished successfully!");
}

syncRatings();
