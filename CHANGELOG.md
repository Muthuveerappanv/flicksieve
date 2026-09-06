# Changelog

All notable changes to FlickSieve are documented here.

## [0.2.0] - 2026-09-06

### Added
- **Sieve India** — critic-first discovery of Tamil, Telugu, Malayalam and Hindi
  films from 11 handpicked press outlets (The Indian Express, 123Telugu, Bollywood
  Hungama, NDTV, News18, MovieCrow, OnManorama, and the four Times of India
  language desks). Ranked by professional critic star ratings across a 3- or
  6-month window; searchable and filterable by verdict, language and outlet count.
  IMDb and Letterboxd are shown as context only. YouTube reviewers are an opt-in
  supplement.
- **TV series as a first-class media type** — per-season Rotten Tomatoes critic
  and audience scores, a season-ratings drawer on the show card, TV-aware Sieve
  scoring, and media-type-scoped watchlist / history.
- **Rotten Tomatoes "at home" discovery** — surfaces movies and TV that recently
  started streaming with a strong audience score.
- **Unified Discover surface** — one screen with four source tabs (Timeline · At
  Home · Weekly · India), replacing the previous split between the OTT tracker and
  a separate Sieve India tab.
- Test and lint harness: Vitest unit tests, a Python `unittest` suite, ESLint with
  `react-hooks`, and a CI workflow running all of them plus the build.
- `requirements.txt` as the single source of truth for Python scraper dependencies.
- `CHANGELOG.md`.

### Changed
- Upgraded to **React 19** and **Vite 8** (`@vitejs/plugin-react` 6, `lucide-react`
  1). `npm audit` is now clean.
- One canonical Sieve Score implementation (`src/utils/score.js`), replacing seven
  copies — one of which used the Rotten Tomatoes critics score where the others
  used the audience score, so the same title showed different stars on different
  tabs.
- The dev-server API middleware moved out of `vite.config.js` into
  `scripts/dev-api-plugin.js`; Python interpreter resolution is now
  cross-platform.
- Consolidated `App.jsx`: the duplicated Recommendations / Sieved Out views share
  `FilterBar` and `ShowGrid`; persistence writes are debounced; bulk imports flush
  in a single state update.
- App-wide toast notifications via context (replacing scattered `alert()` calls).
- CSS consistency pass: added classes that were referenced but never defined
  (Sieve India rendered partly unstyled), removed dead rules, and hoisted
  theme-breaking inline styles.

### Fixed
- Discover timeline "Today" / "Upcoming" badges used a hard-coded date and were
  permanently wrong.
- "At home" imports fabricated `language`, `genres` and `platform` for every
  title instead of letting the resolver fill them in.
- Same-named films from different years collided in the import selection state.
- Letterboxd lookups for TV shows could return an unrelated film's rating.
- The packaged desktop binary contained a hard-coded path to the developer's
  working tree and could prefer it over its own bundle.
- `npm run sync-ratings` wrote to the committed seed fixture instead of the live
  library.

## [0.1.4] and earlier

See the Git history.

[0.2.0]: https://github.com/Muthuveerappanv/flicksieve/releases/tag/v0.2.0
