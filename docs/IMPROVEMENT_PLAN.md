# FlickSieve Improvement Plan (post-0.2.0)

0.2.0 cleaned up the codebase: one score implementation, a unified Discover
screen, tests, lint, and CI. The weak spot now is **the desktop runtime**, not
the code structure. The packaged app is fragile on any machine other than the
developer's. Fix that before adding features.

Priorities: **P0** means the shipped product is broken or at risk. **P1** means
real user pain. **P2** means leverage and polish.

---

## P0 — Make the packaged app actually work

### 1. Bundle a Python runtime with the app, and stop depending on the system `python3`
**Problem.** `tauri.conf.json` bundles only the `.py` files. In release builds,
`resolve_paths` (`src-tauri/src/lib.rs`) falls back to the system `python3`
from Homebrew, `/usr/local`, or the PATH. That interpreter will not have
`requests`, `beautifulsoup4`, `letterboxdpy` or `curl_cffi`. On a clean Mac,
every ratings call and every Discover call fails with an ImportError.

**Options (in order of preference):**
- **Sidecar binaries (recommended).** Freeze each scraper (or a single
  dispatcher, `flicksieve-scraper <command> ...`) with PyInstaller or Nuitka in
  the release workflow. Ship it through Tauri's `externalBin` sidecar support.
  This removes the need for Python on the user's machine and avoids
  path-guessing.
- First-run venv bootstrap into `~/.flicksieve/venv`. This is cheaper to build,
  but it still needs Python 3.9+ on the machine and adds a network-dependent
  first launch.

**Done when:** a fresh macOS VM with no Python can install the DMG, add a
title, and get IMDb, RT and Letterboxd scores.

### 2. Stop blocking the UI thread on scraper calls
**Problem.** Every `#[tauri::command]` that runs a scraper is a synchronous
`fn`, and it calls `Command::output()` with no timeout. Tauri 2 runs sync
commands on the main thread. A `discover_indian` crawl can take minutes, and
during that time the window can freeze. A hung site hangs the call forever.

**Fix.** Make the commands `async` and use `tokio::process` (or
`spawn_blocking`). Add a per-command timeout: about 30s for single-title
lookups and about 5 minutes for discovery, matching the dev plugin's 300s.
Kill the child process when the timeout hits.

### 3. Make writes to the user's data safe
**Problem.**
- `save_data_file` writes in place with `fs::write`. A crash in the middle of a
  write leaves a truncated `shows.json`.
- `loadAll` (`src/App.jsx`) calls `JSON.parse` with no per-file guard. One
  corrupt file aborts the bootstrap. After that, the debounced save effects can
  write the seed fixtures over the user's real library.

**Fix.**
- Do an atomic write: write a temp file, fsync it, rename it over the original.
- Keep a rolling `.bak` of the previous good version.
- Parse each file separately. On failure, quarantine the file
  (`shows.json.corrupt-<ts>`), show a toast, and **do not enable autosave** for
  that file until the user acts.
- Add a `schemaVersion` field so future migrations (like `migrateReviewers`)
  are explicit instead of ad hoc.

### 4. Set a CSP
`app.security.csp` is `null`. The app renders scraped HTML-derived strings and
remote posters. Set a restrictive CSP: `img-src` for the IMDb, RT and
Letterboxd CDNs, `connect-src` limited to what `api.js` actually calls, and no
inline scripts.

---

## P1 — Reliability of the data itself

### 5. Cache scraper results and refresh them in the background
Today every refresh spawns Python and hits three sites live, with no memory of
past results. Add a small cache keyed by `(source, imdbId|title+year)` with a
TTL: about 7 days for released titles and about 1 day for titles less than 30
days old. Store it as SQLite or JSON in the data folder.

The library view should read from the cache instantly. A "refresh stale" job
can then update scores in batches. This also lowers the chance of RT or
Letterboxd rate-limiting or banning the user's IP.

### 6. Scraper health checks, so you hear about breakage before users do
The scrapers depend on page structure: RT JSON blobs, Letterboxd pages, and 11
Indian outlets in `discover_indian.py` (999 LOC). These will break quietly.

- **Fixture tests:** save representative HTML per outlet and test the parsers
  offline. These are deterministic and run in CI.
- **Weekly scheduled CI canary:** run each scraper against 2–3 known titles. If
  the results are empty or come back in the wrong shape, open an issue.
- **Structured errors:** return `{source, status: ok|not_found|blocked|parse_error}`
  from each scraper instead of failing the whole run. The UI then shows *which*
  pillar is missing and why.

### 7. Make the Sieve Score account for confidence
`calculateSieveScore` is a plain mean of whichever pillars exist. A title with
only a 9.0 IMDb score from 40 votes ranks above a 4.2/5 film with all three
pillars. Apply a small Bayesian shrink toward a prior: weight each pillar by
whether it is present and, where available, by its vote count. Show the
confidence on the card, for example "3 of 3 sources" or "1 source".

The work is small and the ranking quality gains a lot. `score.test.js` already
gives you the harness.

---

## P2 — Maintainability and reach

### 8. Break up `App.jsx` (1,019 LOC)
State, persistence, the ratings-refresh orchestration and the import pipeline
all live in a single component. Pull out:
- `useLibraryStore`: shows, watchlist, history and theme, plus persistence.
  Fold in item 3's safe-load logic here.
- `ratingsService`: refresh one title, import many titles, concurrency limits.
  Today `Promise.allSettled` across N imports fires 3N scraper processes at
  once. Cap concurrency at about 3.

Do this alongside items 3 and 5. Those changes touch the same code, so don't
refactor it in isolation.

### 9. Fill the gaps in test coverage
The frontend tests cover only `score`, `imdbMatch` and one API test. Add a
Vitest + Testing Library smoke test for the main flows: add title → ratings
appear → sieve filters it → watchlist → history. The CI workflow doesn't run
`cargo test`, so add it, or cut the Rust tests down to the config and
file-operation tests that don't need the dev venv.

### 10. Ship releases for more platforms
`release.yml` builds only universal macOS, and the build is unsigned or
unnotarized. Gatekeeper will warn every user. Add Apple notarization first,
then Windows and Linux matrix jobs once the sidecar from item 1 removes the
Python dependency. That dependency is the actual blocker for cross-platform
builds.

### 11. Product bets, after the P0 and P1 work
- **"Where to watch" for India and the US** through a JustWatch-style
  availability source. This turns the app from "is it good?" to "is it good
  *and* on a service I already pay for?"
- **Personal taste weighting:** learn the pillar weights from the user's own
  watched-history ratings. This is the feature that would make the score
  personal instead of generic.
- **Alerts:** "a film from my Sieve India shortlist just landed on an OTT
  service I have", by joining the weekly 91mobiles data with the Discover
  results.

---

## Recommended sequencing

| Phase | Items | Why |
|---|---|---|
| 0.2.1 (hotfix) | 2, 3, 4 | Small, contained Rust and JS changes. These stop the freezes and the data loss. |
| 0.3.0 | 1, 10 (notarize macOS only) | The release that works for people other than the author. |
| 0.4.0 | 5, 6, 7, 8 | Faster, trustworthy scores. Do the refactor here, where it pays off. |
| Later | 9 (ongoing), 10 (Win/Linux), 11 | Features come after the foundation is solid. |

**Don't do yet:** add a cloud backend or accounts, or rewrite the scrapers in
Rust. Local-first with JSON files is the right fit for a single-user tool. The
problem is unsafe writes, not the storage model.
