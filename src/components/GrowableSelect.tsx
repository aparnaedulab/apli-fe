import { useState } from 'react';
import './GrowableSelect.css';

export interface SelectOption {
  value: string;
  label: string;
  /** False for choices this company added, so the list can say which. */
  isStandard?: boolean;
}

/** A yes/no the new choice has to answer before it can be added. */
export interface OptionTrait {
  key: string;
  label: string;
  hint?: string;
  /** Greyed out until another trait is ticked, where one implies the other. */
  requires?: string;
}

/**
 * A dropdown you can add to without leaving the form.
 *
 * Every campus recruiter eventually needs a word the product did not ship -
 * a machine test, a field-based role - and the alternative to this is either
 * a support ticket or the recruiter picking whichever wrong option is closest,
 * which is worse because nobody ever finds out.
 *
 * What gets added belongs to the company that added it. The choices that ship
 * with the product cannot be edited away from underneath the roles using them.
 */
export default function GrowableSelect({
  value,
  options,
  onChange,
  onAdd,
  disabled,
  includeBlank,
  blankLabel = 'Not stated',
  addLabel = 'Add another…',
  traits = [],
  traitsIntro,
  id,
  className,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Saves the new choice and returns it, so it can be selected straight away. */
  onAdd: (label: string, traits: Record<string, boolean>) => Promise<SelectOption>;
  disabled?: boolean;
  includeBlank?: boolean;
  blankLabel?: string;
  addLabel?: string;
  /**
   * Questions the new choice must answer.
   *
   * Only where the form behaves differently depending on the answer - an
   * employment type that pays a stipend has to say so, or the form has no way
   * to know whether to ask for one. A list that is only ever read has none.
   */
  traits?: OptionTrait[];
  traitsIntro?: string;
  /** For a label to point at, and a form's own input styling. */
  id?: string;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ADD = '__add__';

  async function commit() {
    const label = draft.trim();
    if (!label) {
      setAdding(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const option = await onAdd(label, ticked);
      // Selected immediately: somebody who just typed it wants it chosen, and
      // making them find it in the list again is a step for nothing.
      onChange(option.value);
      setDraft('');
      setTicked({});
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that.');
    } finally {
      setBusy(false);
    }
  }

  if (adding) {
    return (
      <div className="growable">
        {traitsIntro && <p className="growable-intro">{traitsIntro}</p>}
        <div className="growable-add">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What do you call it?"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              }
              if (e.key === 'Escape') {
                setAdding(false);
                setError(null);
              }
            }}
          />
          <button type="button" className="btn btn-primary" onClick={commit} disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
        {traits.length > 0 && (
          <div className="growable-traits">
            {traits.map((t) => {
              const blocked = Boolean(t.requires && !ticked[t.requires]);
              return (
                <label key={t.key} className={blocked ? 'is-blocked' : ''}>
                  <input
                    type="checkbox"
                    checked={Boolean(ticked[t.key]) && !blocked}
                    disabled={busy || blocked}
                    onChange={(e) => setTicked((p) => ({ ...p, [t.key]: e.target.checked }))}
                  />
                  <span>
                    {t.label}
                    {t.hint && <span className="growable-hint">{t.hint}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {error && <span className="growable-error">{error}</span>}
      </div>
    );
  }

  const standard = options.filter((o) => o.isStandard !== false);
  const mine = options.filter((o) => o.isStandard === false);

  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === ADD) {
          setAdding(true);
          return;
        }
        onChange(e.target.value);
      }}
    >
      {includeBlank && <option value="">{blankLabel}</option>}

      {standard.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}

      {/* Grouped so it is obvious which of these the company invented. */}
      {mine.length > 0 && (
        <optgroup label="Added by you">
          {mine.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}

      {!disabled && <option value={ADD}>+ {addLabel}</option>}
    </select>
  );
}
