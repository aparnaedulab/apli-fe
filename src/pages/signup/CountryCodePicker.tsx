import { useEffect, useMemo, useRef, useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import { DIAL_CODES, type DialCode } from './phone';

/**
 * The country code beside the mobile number.
 *
 * Closed, it is only as wide as "+91 IN". Open, it searches as the student
 * types - a country's name, its code with or without the plus, or its two
 * letters - with the country they are most likely in at the top, so most
 * students never type at all.
 */
export default function CountryCodePicker({
  value,
  onChange,
  suggested,
}: {
  value: CountryCode;
  onChange: (c: CountryCode) => void;
  /** Shown first, above everything else: India and the browser's country. */
  suggested: CountryCode[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const current = DIAL_CODES.find((d) => d.country === value);

  const shown = useMemo(() => {
    const text = q.trim().toLowerCase().replace(/^\+/, '');
    if (!text) {
      const top = suggested.map((c) => DIAL_CODES.find((d) => d.country === c)).filter(Boolean) as DialCode[];
      return [...top, ...DIAL_CODES.filter((d) => !suggested.includes(d.country))];
    }
    // Digits search the code ("44" -> United Kingdom); letters the name, or
    // the two-letter code ("uk" is not one, but "gb" is).
    const digits = /^\d+$/.test(text);
    const hits = DIAL_CODES.filter((d) =>
      digits
        ? d.code.startsWith(text)
        : d.name.toLowerCase().includes(text) || d.country.toLowerCase() === text,
    );
    // A name that starts with the letters beats one that only contains them.
    return hits.sort((a, b) => {
      const rank = (d: DialCode) =>
        digits ? (d.code === text ? 0 : 1) : d.name.toLowerCase().startsWith(text) ? 0 : 1;
      return rank(a) - rank(b);
    });
  }, [q, suggested]);

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    list.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openList() {
    setQ('');
    setActive(0);
    setOpen(true);
  }

  function choose(d: DialCode) {
    onChange(d.country);
    setOpen(false);
  }

  return (
    <div className="su-cc" ref={box}>
      <button
        type="button"
        className="su-cc-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${current ? `${current.name} +${current.code}` : 'choose'}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            openList();
          }
        }}
      >
        <b>+{current?.code ?? '?'}</b>
        <small>{value}</small>
        <span className="su-cc-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="su-cc-pop">
          <input
            autoFocus
            className="su-cc-search"
            value={q}
            placeholder="Search country or code"
            aria-label="Search country or code"
            aria-controls="su-cc-list"
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (shown[active]) choose(shown[active]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />
          <ul className="su-cc-list" id="su-cc-list" role="listbox" ref={list}>
            {shown.length === 0 && <li className="su-cc-empty">No country matches “{q}”.</li>}
            {shown.map((d, i) => (
              <li
                key={d.country}
                role="option"
                aria-selected={d.country === value}
                className={[
                  i === active ? 'is-active' : '',
                  d.country === value ? 'is-on' : '',
                  !q && i === suggested.length - 1 ? 'is-last-suggested' : '',
                ].join(' ')}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(d);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{d.name}</span>
                <b>+{d.code}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
