import { exec } from 'child_process';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

console.log('⚡ Setting up Python virtual environment...');

exec('python3 -m venv .venv', { cwd: rootDir }, (err) => {
  if (err) {
    console.warn('\n⚠️  [FlickSieve Warning]: Could not create Python virtual environment. Please ensure python3 is installed on your system.');
    console.warn(err.message);
    return;
  }
  
  console.log('⚡ Installing Python scraping dependencies (requests, beautifulsoup4, letterboxdpy, curl_cffi)...');
  const pipPath = process.platform === 'win32' ? '.venv\\Scripts\\pip' : '.venv/bin/pip';
  
  exec(`"${pipPath}" install requests beautifulsoup4 letterboxdpy curl_cffi`, { cwd: rootDir }, (err, stdout, stderr) => {
    if (err) {
      console.warn('\n⚠️  [FlickSieve Warning]: Failed to install Python dependencies. Scrapers might fail.');
      console.warn(stderr || err.message);
    } else {
      console.log('✅ Python virtual environment and dependencies configured successfully!');
    }
  });
});
