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
- **🇮🇳 Sieve India**: Tracks the film critics you trust — YouTube reviewers and Indian press — and surfaces what they've actually reviewed. Ranked by how many of your reviewers covered each film, because crowd ratings for Indian cinema are widely gamed. IMDb and Letterboxd scores are shown as context only, never used to rank or filter (a measured 38% of films your reviewers cover have no Letterboxd entry at all).
- **🔖 Watchlist & Logs**: Manage your watchlist and log watched titles with notes.
- **🎨 Curated Accent Themes**: Toggle between five modern, vibrant visual themes:
  - **Amethyst** (Vibrant Purple & Pink - Default)
  - **Cyberpunk** (Neon Indigo & Cyan)
  - **Sunset Glow** (Amber Gold & Rose Red)
  - **Emerald Breeze** (Lush Green & Mint)
  - **Crimson Cinema** (Sleek Theater Red)

---

## 🛠️ Technology Stack

- **Frontend**: React (v18), Vite, Lucide React (Icons)
- **Styling**: Custom CSS variables, responsive design, glassmorphic accents, and micro-animations.
- **Backend Scraping**: Node middleware proxy running local Python scripts (`BeautifulSoup`, `requests`, `letterboxdpy`) to retrieve up-to-date scores.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)

### 1. Clone & Setup Project
FlickSieve has an automated setup script. Running `npm install` will automatically download Node modules, create the Python virtual environment (`.venv/`), and install all Python scraping dependencies (e.g. `requests`, `beautifulsoup4`, `letterboxdpy`):
```bash
# Clone the repository
git clone https://github.com/Muthuveerappanv/flicksieve.git
cd flicksieve

# Run unified setup
npm install
```

> [!NOTE]
> Make sure `python3` is installed on your system so the postinstall script can automatically configure the virtual environment. If the script fails, you can set it up manually: `python3 -m venv .venv && .venv/bin/pip install requests beautifulsoup4 letterboxdpy`.

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
├── scripts/                  # Python scraping scripts
│   ├── discover_indian.py    # Reviewer-consensus discovery (YouTube + Indian press)
│   ├── fetch_letterboxd.py   # Letterboxd scraper
│   ├── fetch_rottentomatoes.py # Rotten Tomatoes scraper
│   ├── sync_ratings.js       # CLI ratings sync script
│   └── scrape_91mobiles.py   # 91mobiles parser
├── src/                      # React frontend
│   ├── components/           # UI Components (ShowCard, Settings, Wheel, etc.)
│   ├── data/                 # Initial datasets
│   ├── App.jsx               # Main container and state manager
│   ├── index.css             # Unified design system & custom themes
│   └── main.jsx              # React mounting root
├── package.json              # NPM configuration
├── vite.config.js            # Vite configuration & server middleware proxies
└── README.md                 # Project documentation
```

---

## 🎨 Theme Customization

Themes can be adjusted in the **Settings** view under **Appearance & Theme**. The themes adapt dynamically using CSS variables configured on the HTML root element (`data-theme`). 

---

## 📄 License
This project is open-source and licensed under the MIT License - see the [LICENSE](file:///Users/muthu/work/utilities/flicksieve/LICENSE) file for details.

Copyright (c) 2026 Muthu Venkatachalam. All rights reserved.

