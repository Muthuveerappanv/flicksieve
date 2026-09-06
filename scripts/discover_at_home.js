import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const pythonPath = path.join(__dirname, '..', '.venv', 'bin', 'python3');
const scriptPath = path.join(__dirname, 'discover_at_home.py');
const seedPath = path.join(__dirname, '..', 'src', 'data', 'shows.json');
const jsonOutPath = path.join(__dirname, '..', '.discover-at-home.json');

function expandTilde(p) {
  if (p && p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

// Resolve the live library the same way vite.config.js does.
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

function parseArgs(argv) {
  const opts = { days: null, minAudience: null, sort: null, json: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--sort=date' || arg === '--by-date') opts.sort = 'date';
    else if (arg === '--sort=audience') opts.sort = 'audience';
    else if (arg.startsWith('--days=')) opts.days = arg.split('=')[1];
    else if (arg.startsWith('--min-audience=')) opts.minAudience = arg.split('=')[1];
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const libraryPath = resolveLibraryPath();
  let owned = new Set();
  try {
    const shows = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
    owned = new Set(shows.map((s) => (s.title || '').toLowerCase()));
  } catch (err) {
    console.error(`Could not read library at ${libraryPath}:`, err.message);
  }

  const { stdout } = await execFilePromise(pythonPath, [
    scriptPath,
    opts.days || 'None',
    opts.minAudience || 'None',
    opts.sort || 'None',
  ], { maxBuffer: 20 * 1024 * 1024, timeout: 5 * 60 * 1000 });

  const data = JSON.parse(stdout.trim());
  if (data.error) {
    console.error('Discovery failed:', data.error);
    process.exit(1);
  }

  const fresh = data.movies.filter((m) => !owned.has((m.title || '').toLowerCase()));
  const alreadyOwned = data.movies.length - fresh.length;

  const report = { ...data, library: libraryPath, newCount: fresh.length, alreadyOwned, movies: fresh };
  fs.writeFileSync(jsonOutPath, JSON.stringify(report, null, 2), 'utf-8');

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('');
  console.log(`Rotten Tomatoes — new "at home" movies`);
  console.log(`  window: last ${data.windowDays} days   audience >= ${data.minAudience}   sorted by ${data.sortBy === 'date' ? 'streaming date' : 'audience score'}   (${data.pagesCrawled} pages)`);
  console.log(`  library: ${libraryPath}`);
  console.log(`  ${fresh.length} new candidate(s), ${alreadyOwned} already in your library`);
  if (data.failedPages) {
    console.log(`  ⚠ ${data.failedPages} page(s) failed (RT rate-limited) — results may be incomplete; retry in a minute`);
  }
  console.log('');

  if (fresh.length === 0) {
    console.log('  Nothing new. Try a wider window: npm run discover -- --days=365');
    return;
  }

  fresh.forEach((m, i) => {
    const rank = String(i + 1).padStart(2, ' ');
    const critic = m.criticScore == null ? ' --' : `${m.criticScore}%`;
    console.log(`  ${rank}. ${m.title}`);
    console.log(`      audience ${m.audienceScore}%  /  critics ${critic}   ·   streaming ${m.streamingDate}`);
    console.log(`      ${m.url}`);
    console.log('');
  });

  console.log(`  Full JSON: ${jsonOutPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
