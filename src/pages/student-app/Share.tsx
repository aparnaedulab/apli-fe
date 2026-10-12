import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { studentAppApi, type ShareOption } from '../../api/studentApp';
import { CompanyTile } from './Shell';

/**
 * Who may see one finished simulation. Nothing is shared until the student
 * ticks a company, and unticking takes it back. The company that set the
 * simulation is listed first, because it is the obvious one to show.
 */
export default function ShareDialog({
  runId,
  title,
  onClose,
  onSaved,
}: {
  runId: string;
  title: string;
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const [options, setOptions] = useState<ShareOption[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    studentAppApi
      .shareOptions(runId)
      .then((r) => {
        setOptions(r.companies);
        setPicked(new Set(r.companies.filter((c) => c.shared).map((c) => c.id)));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the companies.'));
  }, [runId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    box.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await studentAppApi.setShares(runId, [...picked]);
      onSaved(r.companies.filter((c) => c.shared).length);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <div className="sa-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sa-dialog" role="dialog" aria-modal="true" aria-labelledby="sa-share-title" tabIndex={-1} ref={box}>
        <p className="sa-eyebrow">Share your work</p>
        <h2 id="sa-share-title">{title}</h2>
        <p className="sa-dialog-lede">
          Ticked companies can see what you handed in and your certificate. Nobody else can. Change it whenever you like.
        </p>

        {error && <p className="sa-alert">{error}</p>}
        {!options && !error && <p className="sa-loading">Loading…</p>}
        {options && (
          <ul className="sa-share-list">
            {options.map((c) => {
              const on = picked.has(c.id);
              return (
                <li key={c.id}>
                  <label className={on ? 'is-on' : ''}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (on) n.delete(c.id);
                          else n.add(c.id);
                          return n;
                        })
                      }
                    />
                    <CompanyTile company={{ id: c.id, name: c.name, logoUrl: c.logoUrl }} />
                    <span>
                      <b>{c.name}</b>
                      {c.isOwner && <i>Set this simulation</i>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="sa-dialog-foot">
          <span className="sa-dialog-count">
            {picked.size === 0 ? 'Private - shared with nobody' : `Shared with ${picked.size} compan${picked.size === 1 ? 'y' : 'ies'}`}
          </span>
          <button type="button" className="sa-btn is-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sa-btn" disabled={busy || !options} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
