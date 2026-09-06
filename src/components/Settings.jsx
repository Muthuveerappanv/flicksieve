import React, { useState, useRef } from 'react';
import { Plus, Trash2, Download, Upload, RotateCcw, RotateCw, AlertTriangle } from 'lucide-react';
import { formatSieveScore } from '../utils/score.js';

export default function Settings({
  shows = [],
  reviewers = [],
  onAddReviewer,
  onDeleteReviewer,
  onUpdateReviewer,
  onDeleteShow,
  onRefreshShowRatings,
  onResetAllData,
  onImportData,
  exportDataJSON,
  theme,
  onThemeChange,
  dataFolder = '',
  onUpdateDataFolder
}) {
  // Add Reviewer state
  const [revName, setRevName] = useState('');
  const [revLanguages, setRevLanguages] = useState([]);

  // Data folder local state
  const [folderInput, setFolderInput] = useState(dataFolder || '');

  React.useEffect(() => {
    setFolderInput(dataFolder || '');
  }, [dataFolder]);

  // Import / JSON State
  const [importJson, setImportJson] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Manage Database Titles Search State
  const [deleteSearchQuery, setDeleteSearchQuery] = useState('');

  const matchedShowsToDelete = React.useMemo(() => {
    if (!deleteSearchQuery.trim()) return [];
    const query = deleteSearchQuery.toLowerCase();
    return shows.filter(show => 
      show.title.toLowerCase().includes(query) || 
      (show.genres && show.genres.some(g => g.toLowerCase().includes(query)))
    );
  }, [shows, deleteSearchQuery]);

  // Bulk Refresh State
  const [isBulkRefreshing, setIsBulkRefreshing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, title: '' });
  const cancelBulkRef = useRef(false);

  const handleBulkRefresh = async () => {
    if (shows.length === 0) return;
    setIsBulkRefreshing(true);
    cancelBulkRef.current = false;
    setBulkProgress({ current: 0, total: shows.length, title: '' });

    for (let i = 0; i < shows.length; i++) {
      if (cancelBulkRef.current) {
        break;
      }
      const show = shows[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1, title: show.title }));
      
      if (onRefreshShowRatings) {
        await onRefreshShowRatings(show.id, false);
      }
      
      // Sequential pacing delay (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsBulkRefreshing(false);
    setBulkProgress({ current: 0, total: 0, title: '' });
  };

  const handleCancelBulkRefresh = () => {
    cancelBulkRef.current = true;
    setIsBulkRefreshing(false);
  };

  const handleAddReviewerSubmit = (e) => {
    e.preventDefault();
    if (!revName.trim()) return;

    onAddReviewer({
      id: `rev-${Date.now()}`,
      name: revName.trim().toLowerCase(),
      urlPattern: `https://www.youtube.com/results?search_query=${encodeURIComponent(revName.trim().toLowerCase())}+{title}`,
      languages: revLanguages
    });
    setRevName('');
    setRevLanguages([]);
  };

  const handleToggleLanguage = (reviewerId, language) => {
    const rev = reviewers.find(r => r.id === reviewerId);
    if (!rev) return;
    const currentLangs = rev.languages || [];
    let newLangs;
    if (currentLangs.includes(language)) {
      newLangs = currentLangs.filter(l => l !== language);
    } else {
      newLangs = [...currentLangs, language];
    }
    onUpdateReviewer({ ...rev, languages: newLangs });
  };



  const handleExportClick = () => {
    const dataStr = exportDataJSON();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `flicksieve-data-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportSubmit = (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJson);
      onImportData(parsed);
      setImportJson('');
      alert('Data imported successfully!');
    } catch (err) {
      alert('Invalid JSON structure. Please check and try again.');
    }
  };

  return (
    <div className="settings-container">
      {/* SECTION: Data Folder Configuration */}
      <div className="settings-card" id="settings-data-folder-card">
        <h2>Data Folder Location</h2>
        <p className="settings-card-subtitle">
          Configure the folder path on your computer where FlickSieve stores all its data files (shows, watchlist, etc.). This path is shared between the macOS app and web app.
        </p>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (folderInput.trim()) {
            onUpdateDataFolder(folderInput.trim());
          }
        }} className="add-channel-form" id="data-folder-form">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label" htmlFor="data-folder-input">Local Folder Path</label>
            <input
              type="text"
              id="data-folder-input"
              className="form-input"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="e.g. ~/.flicksieve"
              required
            />
          </div>
          <button 
            type="submit" 
            id="btn-update-data-folder"
            className="btn btn-primary" 
            style={{ alignSelf: 'flex-end', padding: '0.75rem 1.5rem' }}
          >
            Update Folder
          </button>
        </form>
      </div>

      {/* SECTION: Appearance & Theme */}
      <div className="settings-card" id="settings-appearance-card">
        <h2>Appearance & Theme</h2>
        <p className="settings-card-subtitle">
          Personalize the look and feel of your FlickSieve dashboard by choosing a curated color theme.
        </p>

        {/* NOTE: each swatch's inline --theme-primary / --theme-secondary mirror the
            accent hex pairs in the [data-theme=...] blocks in index.css. They are
            intentionally hardcoded so a swatch shows its own theme colour regardless
            of the active theme — keep the two in sync when editing a palette. */}
        <div className="theme-grid">
          <button 
            type="button"
            className={`theme-option ${theme === 'amethyst' ? 'active' : ''}`}
            onClick={() => onThemeChange('amethyst')}
            style={{ '--theme-primary': '#8b5cf6', '--theme-secondary': '#d946ef' }}
          >
            <div className="theme-preview">
              <span className="theme-dot primary"></span>
              <span className="theme-dot secondary"></span>
            </div>
            <div className="theme-details">
              <span className="theme-name">Amethyst</span>
              <span className="theme-desc">Vibrant Purple & Pink</span>
            </div>
          </button>

          <button 
            type="button"
            className={`theme-option ${theme === 'cyberpunk' ? 'active' : ''}`}
            onClick={() => onThemeChange('cyberpunk')}
            style={{ '--theme-primary': '#6366f1', '--theme-secondary': '#06b6d4' }}
          >
            <div className="theme-preview">
              <span className="theme-dot primary"></span>
              <span className="theme-dot secondary"></span>
            </div>
            <div className="theme-details">
              <span className="theme-name">Cyberpunk</span>
              <span className="theme-desc">Neon Indigo & Cyan</span>
            </div>
          </button>

          <button 
            type="button"
            className={`theme-option ${theme === 'sunset' ? 'active' : ''}`}
            onClick={() => onThemeChange('sunset')}
            style={{ '--theme-primary': '#f59e0b', '--theme-secondary': '#f43f5e' }}
          >
            <div className="theme-preview">
              <span className="theme-dot primary"></span>
              <span className="theme-dot secondary"></span>
            </div>
            <div className="theme-details">
              <span className="theme-name">Sunset Glow</span>
              <span className="theme-desc">Amber Gold & Rose Red</span>
            </div>
          </button>

          <button 
            type="button"
            className={`theme-option ${theme === 'emerald' ? 'active' : ''}`}
            onClick={() => onThemeChange('emerald')}
            style={{ '--theme-primary': '#10b981', '--theme-secondary': '#2dd4bf' }}
          >
            <div className="theme-preview">
              <span className="theme-dot primary"></span>
              <span className="theme-dot secondary"></span>
            </div>
            <div className="theme-details">
              <span className="theme-name">Emerald Breeze</span>
              <span className="theme-desc">Lush Green & Mint</span>
            </div>
          </button>

          <button 
            type="button"
            className={`theme-option ${theme === 'crimson' ? 'active' : ''}`}
            onClick={() => onThemeChange('crimson')}
            style={{ '--theme-primary': '#e50914', '--theme-secondary': '#f43f5e' }}
          >
            <div className="theme-preview">
              <span className="theme-dot primary"></span>
              <span className="theme-dot secondary"></span>
            </div>
            <div className="theme-details">
              <span className="theme-name">Crimson Cinema</span>
              <span className="theme-desc">Sleek Theater Red & Pink</span>
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 1: YouTube Reviewer Channels */}
      <div className="settings-card" id="settings-reviewers-card">
        <h2>YouTube Review Channels</h2>
        <p className="settings-card-subtitle">
          Manage YouTube channels used for scanning reviews. Clicking "Reviews" on a show card will let you search directly.
        </p>
        
        <div className="channel-list">
          {reviewers.map((rev) => (
            <div className="channel-item" key={rev.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <span className="channel-name">{rev.name}</span>
                  <div className="channel-pattern">Search Query: "{rev.name} [title] review"</div>
                </div>
                <button 
                  id={`btn-del-reviewer-${rev.id}`}
                  className="btn-icon"
                  onClick={() => onDeleteReviewer(rev.id)}
                  title={`Delete ${rev.name}`}
                >
                  <Trash2 size={14} style={{ color: 'var(--error)' }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Languages:</span>
                {['Tamil', 'Telugu', 'Malayalam', 'Hindi', 'English'].map(lang => {
                  const langLower = lang.toLowerCase();
                  const isTagged = (rev.languages || []).map(l => l.toLowerCase()).includes(langLower);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleToggleLanguage(rev.id, langLower)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: isTagged ? 'var(--theme-primary, #9333ea)' : 'rgba(255, 255, 255, 0.15)',
                        background: isTagged ? 'var(--theme-primary, #9333ea)' : 'transparent',
                        color: isTagged ? 'white' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        opacity: isTagged ? 1 : 0.6,
                      }}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddReviewerSubmit} className="add-channel-form" id="add-reviewer-form">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label" htmlFor="reviewer-name-input">Reviewer / Channel Name</label>
            <input
              type="text"
              id="reviewer-name-input"
              className="form-input"
              placeholder="e.g. Tried & Refused Productions"
              value={revName}
              onChange={(e) => setRevName(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            id="btn-add-reviewer"
            className="btn btn-primary" 
            style={{ alignSelf: 'flex-end', padding: '0.75rem 1.5rem' }}
          >
            <Plus size={16} /> Add Channel
          </button>
          
          <div className="form-group" style={{ gridColumn: 'span 3', marginTop: '0.5rem' }}>
            <label className="form-label">Languages (Multiple allowed)</label>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '4px' }}>
              {['Tamil', 'Telugu', 'Malayalam', 'Hindi', 'English'].map(lang => {
                const langLower = lang.toLowerCase();
                const isChecked = revLanguages.includes(langLower);
                return (
                  <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRevLanguages(prev => [...prev, langLower]);
                        } else {
                          setRevLanguages(prev => prev.filter(l => l !== langLower));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    {lang}
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </div>

      {/* SECTION: Manage Database Titles */}
      <div className="settings-card" id="settings-manage-shows-card">
        <h2>Manage Database Titles</h2>
        <p className="settings-card-subtitle">
          Search and delete movies or TV series from the database (even if sieved out of active recommendations).
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            🎬 Movies: <strong style={{ color: 'var(--text-primary)' }}>{shows.filter(s => (s.type || 'movie') === 'movie').length}</strong>
          </span>
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            📺 TV Shows: <strong style={{ color: 'var(--accent-primary)' }}>{shows.filter(s => s.type === 'tv').length}</strong>
          </span>
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            Total in DB: <strong style={{ color: 'var(--text-primary)' }}>{shows.length}</strong>
          </span>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search titles to delete..."
            value={deleteSearchQuery}
            onChange={(e) => setDeleteSearchQuery(e.target.value)}
          />
        </div>

        {deleteSearchQuery.trim() && (
          <div style={{ 
            maxHeight: '300px', 
            overflowY: 'auto', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)'
          }}>
            {matchedShowsToDelete.length === 0 ? (
              <p style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                No database titles match "{deleteSearchQuery}"
              </p>
            ) : (
              matchedShowsToDelete.map(show => {
                const formatted = formatSieveScore(show);
                const ratingVal = formatted === 'N/A' ? 'N/A' : `${formatted}/5`;

                return (
                  <div 
                    key={show.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '0.75rem 1rem', 
                      borderBottom: '1px solid var(--border-color)' 
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {show.title} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>({show.year})</span>
                        {show.totalSeasons ? <span style={{ fontSize: '0.7rem', marginLeft: '0.4rem', color: 'var(--accent-primary)', background: 'rgba(168,85,247,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{show.totalSeasons}S</span> : null}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {show.language} • {show.platform} • {show.type === 'tv' ? 'TV Series' : 'Movie'} • Sieve Score: ★ {ratingVal}
                      </div>
                    </div>
                    
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        if (onDeleteShow) {
                          onDeleteShow(show.id);
                        }
                      }}
                      style={{ 
                        padding: '0.35rem 0.5rem', 
                        borderColor: 'rgba(239, 68, 68, 0.4)', 
                        color: 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem'
                      }}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* SECTION: Bulk Ratings Refresh */}
      <div className="settings-card" id="settings-bulk-refresh-card">
        <h2>Bulk Ratings Refresh</h2>
        <p className="settings-card-subtitle">
          Update all movie and TV series ratings in the database with the latest figures from IMDb, Rotten Tomatoes (including TV season breakdown), and Letterboxd. Paces requests sequentially with 500ms delays to respect API rate limits.
        </p>

        {isBulkRefreshing ? (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Refreshing ratings: "{bulkProgress.title}"
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {bulkProgress.current} / {bulkProgress.total} titles
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--accent-primary)',
                transition: 'width 0.2s ease-out'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleCancelBulkRefresh}
                style={{ padding: '0.35rem 1rem', fontSize: '0.8rem', borderColor: 'var(--error)', color: 'var(--error)' }}
              >
                Cancel Refresh
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button 
              className="btn btn-primary" 
              onClick={handleBulkRefresh}
              disabled={shows.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RotateCw size={16} />
              Run Bulk Ratings Refresh
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Last synced database includes {shows.length} active records.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 3: Sync & Backup Data */}
      <div className="settings-card" id="settings-sync-card">
        <h2>Data Backup & Reset</h2>
        <p className="settings-card-subtitle">
          Export your watchlist, history, review channels, and database to keep a local backup, or import a previously exported file.
        </p>

        <div className="db-sync-grid">
          <div className="db-sync-box">
            <Download size={32} style={{ color: 'var(--accent-primary)', alignSelf: 'center' }} />
            <h4>Export Data</h4>
            <p>Download your complete FlickSieve database as a JSON file.</p>
            <button 
              id="btn-export-db"
              className="btn btn-secondary" 
              onClick={handleExportClick}
            >
              Export JSON
            </button>
          </div>

          <div className="db-sync-box">
            <Upload size={32} style={{ color: 'var(--accent-secondary)', alignSelf: 'center' }} />
            <h4>Import Data</h4>
            <p>Restore or merge from an exported JSON file structure.</p>
            
            <textarea
              className="form-input"
              rows="3"
              placeholder="Paste JSON content here..."
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
            />
            
            <button 
              id="btn-import-db"
              className="btn btn-secondary" 
              onClick={handleImportSubmit}
              disabled={!importJson.trim()}
            >
              Import JSON
            </button>
          </div>
        </div>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> Danger Zone
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Reset all application data back to factory defaults (re-curates initial datasets).
            </p>
          </div>
          
          {showResetConfirm ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowResetConfirm(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button 
                id="btn-confirm-reset"
                className="btn btn-primary" 
                onClick={() => {
                  onResetAllData();
                  setShowResetConfirm(false);
                }}
                style={{ backgroundColor: 'var(--error)', backgroundImage: 'none', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
              >
                Yes, Reset All
              </button>
            </div>
          ) : (
            <button 
              id="btn-trigger-reset"
              className="btn btn-secondary" 
              onClick={() => setShowResetConfirm(true)}
              style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            >
              <RotateCcw size={14} />
              Reset All Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
