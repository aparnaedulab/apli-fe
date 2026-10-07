import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { readableOnWhiteText } from '../../lib/brand';

/**
 * The small set of controls the onboarding screens are built from.
 *
 * Kept deliberately few. Every step uses the same field, the same switch and
 * the same chip, so somebody who has learnt one step has learnt them all - the
 * single biggest thing that keeps a long setup from feeling long.
 */

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  wide,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (id: string) => ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={`f ${wide ? 'f-wide' : ''} ${error ? 'has-error' : ''}`}>
      <label className="f-label" htmlFor={id}>
        {label}
        {optional && <span className="f-optional">optional</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="f-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="f-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-desc">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg-opt ${value === o.value ? 'is-on' : ''}`}
          onClick={() => onChange(o.value)}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`chip ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      onClick={onClick}
      title={title}
    >
      {on && (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="chip-tick">
          <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

/** Colours that look good on a university's letterhead and read well as buttons. */
export const SWATCHES = [
  { hex: '#1d3b8b', name: 'Academic blue' },
  { hex: '#8b1d2c', name: 'Heritage maroon' },
  { hex: '#0f6b52', name: 'Campus green' },
  { hex: '#5b2a86', name: 'Royal purple' },
  { hex: '#b4530a', name: 'Saffron' },
  { hex: '#0e7490', name: 'Teal' },
  { hex: '#1f2937', name: 'Graphite' },
  { hex: '#be185d', name: 'Rose' },
];

export function ColourPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const pale = !readableOnWhiteText(value);

  return (
    <div className="colour">
      <div className="colour-swatches" role="radiogroup" aria-label="Brand colour">
        {SWATCHES.map((s) => (
          <button
            key={s.hex}
            type="button"
            role="radio"
            aria-checked={value.toLowerCase() === s.hex}
            className={`swatch ${value.toLowerCase() === s.hex ? 'is-on' : ''}`}
            style={{ background: s.hex }}
            title={s.name}
            aria-label={s.name}
            onClick={() => onChange(s.hex)}
          />
        ))}
        <label className="swatch swatch-custom" title="Pick any colour">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#1d3b8b'}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Pick any colour"
          />
          <span aria-hidden="true">+</span>
        </label>
      </div>
      <input
        className="input input-mono colour-hex"
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        aria-label="Colour as hex"
      />
      {pale && (
        <p className="f-hint colour-warn">
          A pale colour. Buttons will use a deeper shade of it so their text stays readable.
        </p>
      )}
    </div>
  );
}

/** "Saved just now" that quietly ages. */
export function SavedAgo({ at }: { at: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!at) return;
    const t = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
  }, [at]);
  if (!at) return null;
  const s = Math.round((Date.now() - at) / 1000);
  const text = s < 20 ? 'just now' : s < 90 ? 'a minute ago' : `${Math.round(s / 60)} minutes ago`;
  return (
    <span className="saved" aria-live="polite">
      <span className="saved-dot" aria-hidden="true" /> Saved {text}
    </span>
  );
}

/** The bar at the foot of every step. Ctrl/⌘+Enter submits from anywhere. */
export function StepFooter({
  onBack,
  busy,
  submitLabel,
  note,
  error,
}: {
  onBack?: () => void;
  busy: boolean;
  submitLabel: string;
  note?: ReactNode;
  error?: string | null;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        ref.current?.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="step-foot">
      {error && (
        <p className="step-error" role="alert">
          {error}
        </p>
      )}
      <div className="step-foot-row">
        {onBack ? (
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="step-foot-note">{note}</span>
        <button ref={ref} type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
          {!busy && <kbd className="kbd">Ctrl ↵</kbd>}
        </button>
      </div>
    </div>
  );
}

/** Turns an API validation error's fields into a lookup by path. */
export function fieldErrors(err: unknown): Record<string, string> {
  const fields = (err as { fields?: { path: string; message: string }[] })?.fields ?? [];
  return Object.fromEntries(fields.map((f) => [f.path, f.message]));
}

/**
 * An image field that takes a file: drop it, click to pick one, or paste a
 * link if the image already lives somewhere else.
 *
 * The file goes to the server the moment it is chosen, so the preview shows
 * exactly what was stored, and the field then holds its address like any
 * other value - saving the step saves the address.
 */
export function ImageUpload({
  value,
  onChange,
  upload,
  fallback,
  accept,
  hint,
  square,
}: {
  value: string;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<string>;
  /** Drawn when there is no image yet - initials, say. */
  fallback: ReactNode;
  accept: string;
  hint: string;
  /** Small square preview, for a favicon. */
  square?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [linkMode, setLinkMode] = useState(Boolean(value) && /^https:\/\//i.test(value));
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [value]);

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await upload(file));
      setLinkMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That upload did not work.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="upl">
      <div
        className={`upl-drop ${over ? 'is-over' : ''} ${square ? 'is-square' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
      >
        <span className={`upl-preview ${square ? 'is-square' : ''}`}>
          {value && !broken ? <img src={value} alt="" onError={() => setBroken(true)} /> : fallback}
        </span>
        <span className="upl-text">
          <span className="muted">{busy ? 'Uploading…' : 'Drop a file here, or use the upload button'}</span>
          <small>{hint}</small>
        </span>
        <button
          type="button"
          className="upl-btn"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={value ? 'Upload a different image' : 'Upload an image'}
          title={value ? 'Replace' : 'Upload'}
        >
          {busy ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
          )}
        </button>
        {value && !busy && (
          <button type="button" className="icon-btn" onClick={() => onChange('')} aria-label="Remove image" title="Remove">
            ×
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => void take(e.target.files?.[0])} />
      </div>

      {linkMode ? (
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="https://…"
          aria-label="Image link"
        />
      ) : (
        <button type="button" className="linkish upl-link" onClick={() => setLinkMode(true)}>
          Use a link instead
        </button>
      )}
      {broken && value && <p className="f-error">That image could not be loaded.</p>}
      {error && (
        <p className="f-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** A panel that slides in from the right over the page. Escape or the backdrop closes it. */
export function SidePanel({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  /** Pass a stable function (useCallback): the panel re-focuses when it changes. */
  onClose: () => void;
  children: ReactNode;
  /** Pinned to the bottom of the panel - where its main action goes. */
  footer?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    // The page behind should not scroll while the panel is open.
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return (
    <div className="sp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sp" role="dialog" aria-modal="true" aria-labelledby="sp-title" tabIndex={-1} ref={box}>
        <header className="sp-head">
          <div>
            <h2 id="sp-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="sp-body">{children}</div>
        {footer && <footer className="sp-foot">{footer}</footer>}
      </div>
    </div>
  );
}
