# 🍿 FlickSieve

A premium, interactive media dashboard designed to curate, filter, and track movie and TV series recommendations. FlickSieve aggregates ratings across multiple platforms (IMDb, Rotten Tomatoes, and Letterboxd) to calculate a weighted **Sieve Score**, filtering out lower-rated content so you only see the best titles.

---

## ✨ Features

- **🎬 Curated Recommendations Feed**: View movie and TV series details including poster, description, platform badges, and detailed scores.
- **⚡ Smart IMDb Autofill**: Add new titles by searching IMDb. The app automatically fetches the synopsis, year, genres, poster, and language.
- **🔍 Multi-Source Ratings Aggregator**: Local python-based scraping backend automatically retrieves:
  - **IMDb** Ratings
  - **Rotten Tomatoes** (Critics & Audience scores)
  - **Letterboxd** average ratings
- **🎯 Weighted Sieve Filtering**: Filter out titles below a custom score threshold using a responsive slider, or bypass it for unrated entries.
- **🎡 Decider Wheel**: Can't choose what to watch? Spin the interactive decider wheel to pick a random movie from your current filtered recommendations list.
- **📅 Discover**: Keep track of release dates for upcoming movies and TV shows across platforms (Netflix, Prime, Hotstar, etc.) in a timeline layout, plus discover top-rated at-home streaming releases.
- **🇮🇳 Sieve India**: Discovers Tamil, Telugu, Malayalam and Hindi films from handpicked, credible Indian critic websites (The Indian Express, 123Telugu, Bollywood Hungama, NDTV, News18, MovieCrow, OnManorama, and the four Times of India language desks). Ranked by professional critic star ratings across a 3- or 6-month window, searchable and filterable by verdict, language and outlet count. YouTube reviewers are an optional supplement. IMDb and Letterboxd scores are shown as context only — never used to rank or filter.
- **🔖 Watchlist & Logs**: Manage your watchlist and log watched titles with notes.
- **🎨 Curated Accent Themes**: Toggle between five modern, vibrant visual themes:
  - **Amethyst** (Vibrant Purple & Pink - Default)
  - **Cyberpunk** (Neon Indigo & Cyan)
  - **Sunset Glow** (Amber Gold & Rose Red)
  - **Emerald Breeze** (Lush Green & Mint)
  - **Crimson Cinema** (Sleek Theater Red)

---

## 🛠️ Technology Stack

- **Frontend**: React (v19), Vite, Lucide React (Icons)
- **Styling**: Custom CSS variables, responsive design, glassmorphic accents, and micro-animations.
- **Backend Scraping**: In `npm run dev`, a Vite dev-server plugin (`scripts/dev-api-plugin.js`) exposes the `/api/*` routes and shells out to the local Python scrapers in the project `.venv/`. The packaged Tauri desktop app serves the same routes natively from `src-tauri/src/lib.rs`. Python deps (`requests`, `beautifulsoup4`, `letterboxdpy`, `curl_cffi`) are pinned in `requirements.txt`.
  - `fetch_letterboxd.py` / `fetch_rottentomatoes.py` — per-title Letterboxd and Rotten Tomatoes ratings (RT includes season-level scores for TV).
  - `discover_at_home.py` — crawls Rotten Tomatoes "at home" streaming releases (movies or TV) with a strong audience score.
  - `discover_indian.py` — critic-consensus discovery of Indian-language films from handpicked press outlets.
  - `scrape_91mobiles.py` — weekly India OTT release calendar.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v20.19+ or v22.12+)
- Python (v3.9+)

### 1. Clone & Setup Project
FlickSieve has an automated setup script. Running `npm install` will automatically download Node modules, create the Python virtual environment (`.venv/`), and install all Python scraping dependencies listed in `requirements.txt`:
```bash
# Clone the repository
git clone https://github.com/Muthuveerappanv/flicksieve.git
cd flicksieve

# Run unified setup
npm install
```

> [!NOTE]
> Make sure `python3` is installed on your system so the postinstall script can automatically configure the virtual environment. If the script fails, you can set it up manually: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`.

### 3. Run Development Server
Start the frontend and local API handlers:
```bash
npm run dev
```
Open **`http://localhost:5173`** (or the port shown in your terminal) in your browser.

### 4. Build for Production
To build a optimized production bundle:
```bash
npm run build
```

---

## 📂 Project Structure

```
├── dist/                     # Optimized build output
├── scripts/                  # Scrapers + dev tooling
│   ├── dev-api-plugin.js     # Vite dev-server plugin serving the /api/* routes
│   ├── discover_at_home.py   # Rotten Tomatoes "at home" discovery (movies + TV)
│   ├── discover_at_home.js   # CLI wrapper for the above (npm run discover)
│   ├── discover_indian.py    # Reviewer-consensus discovery (Indian press + optional YouTube)
│   ├── fetch_letterboxd.py   # Letterboxd scraper
│   ├── fetch_rottentomatoes.py # Rotten Tomatoes scraper
│   ├── sync_ratings.js       # CLI ratings sync script
│   └── scrape_91mobiles.py   # 91mobiles parser
├── src/                      # React frontend
│   ├── components/           # UI Components (ShowCard, Settings, Wheel, etc.)
│   ├── data/                 # Initial datasets (seed fixtures, reviewers.json)
│   ├── utils/                # api.js, score.js, imdbMatch.js
│   ├── App.jsx               # Main container and state manager
│   ├── index.css             # Unified design system & custom themes
│   └── main.jsx              # React mounting root
├── package.json              # NPM configuration
├── vite.config.js            # Vite configuration & server middleware proxies
└── README.md                 # Project documentation
```

---

## ⚠️ Known limitations

- **Scrapers in packaged builds run on system `python3` with no dependency bundling.**
  `npm run dev` and `npm run tauri dev` use the project `.venv/`, which the postinstall
  script populates from `requirements.txt`. A distributed (bundled) `.app` / installer
  bundles only the scraper source files — it falls back to the system `python3` on
  `PATH` and does **not** ship a virtualenv. For the scrapers to work outside the dev
  commands, the target machine needs `python3` plus the `requirements.txt` packages
  installed into a discoverable environment (e.g. `pip install -r requirements.txt`).
  Bundling the venv into the distributable is out of scope.
- `discover_indian.py` resolves `reviewers.json` from `src/data/` in the dev tree or the
  bundled resource dir; set `FLICKSIEVE_REVIEWERS=/path/to/reviewers.json` to override.
  If none is found it falls back to a small built-in handle list.

---

## 🎨 Theme Customization

Themes can be adjusted in the **Settings** view under **Appearance & Theme**. The themes adapt dynamically using CSS variables configured on the HTML root element (`data-theme`). 

---

## 📄 License
This project is open-source and licensed under the MIT License - see the [LICENSE](file:///Users/muthu/work/utilities/flicksieve/LICENSE) file for details.

Copyright (c) 2026 Muthu Venkatachalam. All rights reserved.

