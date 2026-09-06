import React, { useMemo, useState } from 'react';
import { Search, Bookmark } from 'lucide-react';

/**
 * Stable identity for a discovery row. Same-named films across years (or a
 * remake vs. the original) must not collide, so prefer the IMDb id and fall
 * back to a title+year composite. `shows` records, at-home rows, weekly-scrape
 * rows and India rows all carry `imdbId` + a title-ish field + `year`.
 */
export function rowKey(row) {
  if (!row) return '';
  if (row.imdbId) return String(row.imdbId);
  const title = (row.title || row.film || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const year = row.year ?? row.releaseYear ?? '';
  return `${title}__${year}`;
}

/**
 * Shared results surface for every Discover source: a filter box, a select-all,
 * per-row checkboxes, an "In database" badge for rows already known, an optional
 * add-to-watchlist affordance and an "Import N" button.
 *
 * Existence is an O(1) `Set` lookup — callers pass a memoized `existingKeys`
 * built with `rowKey`; never a per-row `shows.some(...)` scan.
 *
 * @param {object}   props
 * @param {Array}    props.rows          rows to show (already sorted by the caller)
 * @param {Set}      props.existingKeys  keys (via rowKey) already in the DB
 * @param {Function} props.onImport      (selectedRows) => void
 * @param {Function} props.renderRow     (row, { existing }) => ReactNode  — the row body
 * @param {string}   [props.importLabel] button label prefix (default "Import")
 * @param {string}   [props.searchPlaceholder]
 * @param {Function} [props.getText]     (row) => string used by the filter box
 * @param {string}   [props.emptyText]   shown when the filter hides everything
 * @param {Function} [props.onWatchlist] (row) => void — renders a bookmark button when set
 * @param {Function} [props.isWatchlisted] (row) => boolean
 */
export default function DiscoverResults({
  rows = [],
  existingKeys,
  onImport,
  renderRow,
  importLabel = 'Import',
  searchPlaceholder = 'Filter titles…',
  getText = (r) => r.title || r.film || '',
  emptyText = 'Nothing matches your filter.',
  onWatchlist,
  isWatchlisted,
}) {
  const keys = existingKeys instanceof Set ? existingKeys : new Set();
  const [term, setTerm] = useState('');
  const [selection, setSelection] = useState({});

  // Re-seed selection whenever the row set changes (React's "adjust state while
  // rendering" pattern): preselect everything not already in the database.
  const [seenRows, setSeenRows] = useState(null);
  if (seenRows !== rows) {
    setSeenRows(rows);
    const preset = {};
    rows.forEach((r) => {
      const k = rowKey(r);
      preset[k] = !keys.has(k);
    });
    setSelection(preset);
  }

  const visible = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => getText(r).toLowerCase().includes(t));
  }, [rows, term, getText]);

  const selectableVisible = visible.filter((r) => !keys.has(rowKey(r)));
  const selectedRows = selectableVisible.filter((r) => selection[rowKey(r)]);
  const allSelected =
    selectableVisible.length > 0 && selectableVisible.every((r) => selection[rowKey(r)]);

  const toggle = (k) => setSelection((prev) => ({ ...prev, [k]: !prev[k] }));
  const setAll = (val) =>
    setSelection((prev) => {
      const next = { ...prev };
      selectableVisible.forEach((r) => {
        next[rowKey(r)] = val;
      });
      return next;
    });

  if (rows.length === 0) return null;

  return (
    <>
      <div className="discover-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={selectableVisible.length === 0}
            onChange={(e) => setAll(e.target.checked)}
          />
          <span>Select all</span>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onImport(selectedRows)}
          disabled={selectedRows.length === 0}
        >
          {importLabel} {selectedRows.length}
        </button>
      </div>

      <div className="discover-grid">
        {visible.length === 0 ? (
          <div className="empty-state">
            <p>{emptyText}</p>
          </div>
        ) : (
          visible.map((row) => {
            const k = rowKey(row);
            const existing = keys.has(k);
            return (
              <div key={k} className={`discover-row ${existing ? 'is-existing' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!selection[k] && !existing}
                  disabled={existing}
                  onChange={() => toggle(k)}
                />
                {renderRow(row, { existing })}
                <div className="discover-row-aside">
                  {existing && <span className="badge">In database</span>}
                  {onWatchlist && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={
                        isWatchlisted && isWatchlisted(row)
                          ? 'Remove from Watchlist'
                          : 'Add to Watchlist'
                      }
                      onClick={() => onWatchlist(row)}
                      style={{ padding: '0.35rem 0.5rem' }}
                    >
                      <Bookmark
                        size={12}
                        fill={isWatchlisted && isWatchlisted(row) ? 'currentColor' : 'none'}
                      />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
