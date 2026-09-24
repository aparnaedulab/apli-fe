import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './MultiSelect.css';

/**
 * Choosing several things from a list that may be long.
 *
 * This replaced a grid of chips that rendered every option at once. That was
 * fine at a dozen and stopped being fine well before a thousand: the list you
 * had chosen from was the same list you had chosen into, so four selections
 * sat scattered through four hundred alphabetical neighbours and you could
 * not see them without scrolling.
 *
 * So: what is chosen is always on the closed control, and the options only
 * exist while the list is open. Past a few dozen the search box is where you
 * start, and only matches are drawn - the cap below is what keeps a taxonomy
 * of five thousand skills from becoming five thousand DOM nodes.
 */

/** Past this many, nothing is drawn until somebody types. */
const BROWSE_LIMIT = 40;

/** And never more than this at once, however broad the search. */
const DRAW_LIMIT = 100;

export default function MultiSelect({
  label,
  hint,
  options,
  selected,
  onChange,
  disabled,
  emptyMeans = 'Any',
  noOptions = 'Nothing to choose from yet.',
  searchPlaceholder,
}: {
  label: string;
  hint?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** What choosing nothing means, said plainly on the closed control. */
  emptyMeans?: string;
  noOptions?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Anything already chosen that is no longer offered still shows, so a saved
  // criterion never disappears because the list behind it changed.
  const all = useMemo(
    () => [...new Set([...options, ...selected])].sort((a, b) => a.localeCompare(b)),
    [options, selected],
  );

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return all;
    // Things that start with what was typed come first: somebody typing "ja"
    // wants Java before Ninjas.
    const starts = all.filter((o) => o.toLowerCase().startsWith(q));
    const contains = all.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [all, q]);

  const mustSearch = all.length > BROWSE_LIMIT && !q;
  const shown = mustSearch ? [] : matches.slice(0, DRAW_LIMIT);
  const hidden = mustSearch ? all.length : Math.max(0, matches.length - shown.length);

  // Closing on a click anywhere else, which is what a dropdown is expected to
  // do and what nothing on the page would otherwise cause.
  useEffect(() => {
    if (!open) return;

    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  useEffect(() => {
    if (open) search.current?.focus();
    else setQuery('');
  }, [open]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className="multi" ref={box}>
      <div className="multi-head">
        <span className="field-label">{label}</span>
        {selected.length > 0 && !disabled && (
          <button type="button" className="link-btn" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>

      {hint && <p className="multi-hint">{hint}</p>}

      <button
        type="button"
        className={`multi-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || all.length === 0}
        aria-expanded={open}
        aria-controls={listId}
      >
        {/*
          What is chosen, on the closed control. The whole point: you can see
          your selection without opening anything.
        */}
        {selected.length === 0 ? (
          <span className="multi-empty">{all.length === 0 ? noOptions : emptyMeans}</span>
        ) : (
          <span className="multi-chosen">
            {selected.slice(0, 6).map((v) => (
              <span key={v} className="multi-chip">
                {v}
              </span>
            ))}
            {selected.length > 6 && <span className="multi-more">+{selected.length - 6} more</span>}
          </span>
        )}
        <span className="multi-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="multi-panel" id={listId}>
          <input
            ref={search}
            type="search"
            className="multi-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
            aria-label={`Search ${label.toLowerCase()}`}
          />

          <div className="multi-list" role="listbox" aria-multiselectable="true">
            {mustSearch && (
              <p className="multi-note">
                {all.length} to choose from. Type to find one.
              </p>
            )}

            {!mustSearch && shown.length === 0 && (
              <p className="multi-note">Nothing matches that.</p>
            )}

            {shown.map((option) => {
              const on = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`multi-option ${on ? 'is-on' : ''}`}
                  onClick={() => toggle(option)}
                >
                  <span className="multi-tick" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  {option}
                </button>
              );
            })}

            {!mustSearch && hidden > 0 && (
              <p className="multi-note">{hidden} more — keep typing to narrow it.</p>
            )}
          </div>

          <div className="multi-foot">
            <span>
              {selected.length === 0 ? emptyMeans : `${selected.length} chosen`}
            </span>
            <button type="button" className="link-btn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
