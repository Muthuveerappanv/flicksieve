import React from 'react';
import { Filter, Search as SearchIcon } from 'lucide-react';

const LANGUAGES = ['All', 'Tamil', 'English', 'Malayalam', 'Hindi', 'Other'];

/**
 * Shared filter dashboard for the Recommendations and Sieved Out grids:
 * search input, language pills, platform select, sieve slider and the
 * include-unrated checkbox. Fully controlled by the parent.
 */
export default function FilterBar({
  searchTerm,
  onSearchTermChange,
  searchPlaceholder = 'Search by title, genre...',
  selectedLanguage,
  onLanguageChange,
  selectedPlatform,
  onPlatformChange,
  uniquePlatforms,
  minSieveScore,
  onMinSieveScoreChange,
  includeUnrated,
  onIncludeUnratedChange,
}) {
  return (
    <div className="controls-bar">
      {/* Row 1: Search & platform */}
      <div className="controls-row-top">
        <div className="search-wrapper">
          <SearchIcon className="search-icon" />
          <input
            type="text"
            id="search-main"
            className="search-input"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>

        <select
          id="filter-platform"
          className="filter-select"
          value={selectedPlatform}
          onChange={(e) => onPlatformChange(e.target.value)}
        >
          <option value="All">All Streaming</option>
          {uniquePlatforms.map(plat => (
            <option key={plat} value={plat}>{plat}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Language pills + sieve slider */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div className="filter-pills-row">
          <span className="pill-group-label">Languages</span>
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              className={`pill ${lang === 'Tamil' ? 'pill-native ' : ''}${selectedLanguage === lang ? 'active' : ''}`}
              onClick={() => onLanguageChange(lang)}
            >
              {lang === 'Tamil' ? 'Tamil (Native)' : lang}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={14} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Sieve Limit: &gt; {minSieveScore.toFixed(1)}/5
            </span>
            <input
              type="range"
              id="sieve-slider"
              min="3.0"
              max="4.5"
              step="0.1"
              value={minSieveScore}
              onChange={(e) => onMinSieveScoreChange(parseFloat(e.target.value))}
              style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)', width: '100px' }}
            />
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              borderLeft: '1px solid var(--border-color)',
              paddingLeft: '0.75rem',
            }}
          >
            <input
              type="checkbox"
              id="checkbox-include-unrated"
              checked={includeUnrated}
              onChange={(e) => onIncludeUnratedChange(e.target.checked)}
              style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            Include Unrated
          </label>
        </div>
      </div>
    </div>
  );
}
