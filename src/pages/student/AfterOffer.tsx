import { useState } from 'react';
import { ApiError } from '../../api/client';
import {
  afterOfferApi,
  BY_LABEL,
  JOINING_LABEL,
  JOINING_PILL,
  prettyDate,
  relativeDays,
  type JoiningHistoryEntry,
  type RatingRow,
  type StudentOffer,
} from '../../api/afterOffer';
import './AfterOffer.css';

/**
 * The joining card on an accepted offer.
 *
 * One primary action, whichever applies: confirm the date when there is one,
 * otherwise tell us you have heard nothing. Reporting a delay or a withdrawal
 * the student heard about elsewhere is there but quieter - it is the rarer
 * case, and it goes straight to the placement cell.
 */
export function JoiningCard({ offer, onChanged }: { offer: StudentOffer; onChanged: () => void }) {
  const t = offer.tracker;
  const [mode, setMode] = useState<'none' | 'delay' | 'revoked'>('none');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const closed = t.status === 'JOINED' || t.status === 'REVOKED';

  async function send(body: Parameters<typeof afterOfferApi.studentAct>[1], message: string) {
    setBusy(true);
    setError(null);
    try {
      await afterOfferApi.studentAct(offer.applicationId, body);
      setDone(message);
      setMode('none');
      setNote('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`joining is-${t.status.toLowerCase()} ${t.overdue ? 'is-overdue' : ''}`}>
      <div className="joining-head">
        <div>
          <p className="joining-title">Joining</p>
          <p className="joining-date">
            {t.expectedJoiningDate ? (
              <>
                <strong>{prettyDate(t.expectedJoiningDate)}</strong>
                {t.daysToJoining !== null && <span className="muted"> · {relativeDays(t.daysToJoining)}</span>}
              </>
            ) : (
              <span className="muted">No joining date yet</span>
            )}
          </p>
        </div>
        <span className={`pill ${JOINING_PILL[t.status]}`}>{JOINING_LABEL[t.status]}</span>
      </div>

      {t.overdue && (
        <p className="joining-warn">
          The expected date has passed and nobody has recorded that you joined. Your placement cell can see this too.
        </p>
      )}
      {t.reason && (t.status === 'DELAYED' || t.status === 'REVOKED') && <p className="joining-reason">{t.reason}</p>}
      {done && <p className="joining-ok">{done}</p>}
      {error && <p className="f-error">{error}</p>}

      {!closed && mode === 'none' && (
        <div className="joining-actions">
          {t.expectedJoiningDate && t.status !== 'CONFIRMED' ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => send({ action: 'CONFIRM' }, 'Thanks - the company can see you confirmed.')}
            >
              I've seen this date
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => send({ action: 'NO_NEWS' }, 'Noted. Your placement cell can see you are waiting to hear.')}
            >
              I haven't heard anything
            </button>
          )}
          <button type="button" className="link-btn" onClick={() => setMode('delay')}>
            They told me it's delayed
          </button>
          <button type="button" className="link-btn is-danger" onClick={() => setMode('revoked')}>
            They withdrew my offer
          </button>
        </div>
      )}

      {mode !== 'none' && (
        <div className="joining-report">
          <label className="f">
            <span className="f-label">What were you told, and when?</span>
            <textarea
              className="input"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'delay' ? 'e.g. an email said joining moves to next quarter' : 'e.g. a call from HR said the role was closed'}
            />
          </label>
          {mode === 'delay' && (
            <label className="f">
              <span className="f-label">
                New date, if they gave one <span className="f-optional">optional</span>
              </span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          )}
          <p className="f-hint">This goes on your record for this offer and to your placement cell, so they can step in.</p>
          <div className="joining-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('none')}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || note.trim().length < 3}
              onClick={() =>
                mode === 'delay'
                  ? send({ action: 'REPORT_DELAY', note: note.trim(), ...(date ? { date } : {}) }, 'Reported. Your placement cell has been told.')
                  : send({ action: 'REPORT_REVOKED', note: note.trim() }, 'Reported. Your placement cell has been told.')
              }
            >
              Tell my placement cell
            </button>
          </div>
        </div>
      )}

      {t.history.length > 0 && <JoiningHistory entries={t.history} />}
    </div>
  );
}

export function JoiningHistory({ entries }: { entries: JoiningHistoryEntry[] }) {
  return (
    <details className="joining-history">
      <summary>History · {entries.length} update{entries.length === 1 ? '' : 's'}</summary>
      <ol>
        {[...entries].reverse().map((h, i) => (
          <li key={`${h.at}-${i}`}>
            <span className="joining-history-when">
              {new Date(h.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {BY_LABEL[h.by]}
            </span>
            <span>
              {JOINING_LABEL[h.status]}
              {h.date ? ` · ${prettyDate(h.date)}` : ''}
            </span>
            {h.note && <small>{h.note}</small>}
          </li>
        ))}
      </ol>
    </details>
  );
}

const SCALES: { key: 'communication' | 'clarity' | 'fairness'; label: string; hint: string }[] = [
  { key: 'communication', label: 'Communication', hint: 'Did they tell you what was happening, and when?' },
  { key: 'clarity', label: 'Clarity', hint: 'Did you know what each round involved before it started?' },
  { key: 'fairness', label: 'Fairness', hint: 'Did the rounds feel like a fair test of the role?' },
];

/**
 * "Rate how this was run" - once, only after an application closes, and only
 * ever shown to anyone as totals of five or more.
 */
export function RateCard({ row, onRated }: { row: RatingRow; onRated: () => void }) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (row.rating) {
    return <p className="rate-done">You rated how {row.company.name} ran this. Thank you.</p>;
  }
  if (!open) {
    return (
      <button type="button" className="link-btn rate-open" onClick={() => setOpen(true)}>
        Rate how {row.company.name} ran this process
      </button>
    );
  }

  const ready = SCALES.every((s) => scores[s.key]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await afterOfferApi.rate(row.applicationId, {
        communication: scores.communication!,
        clarity: scores.clarity!,
        fairness: scores.fairness!,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onRated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your rating.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rate">
      <p className="rate-intro">
        About the process, not the people. Your answer is only ever shown added up with at least four other students', never
        on its own and never with your name.
      </p>
      {SCALES.map((s) => (
        <div key={s.key} className="rate-row">
          <span className="rate-label">
            {s.label}
            <small>{s.hint}</small>
          </span>
          <span className="rate-scale" role="radiogroup" aria-label={s.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={scores[s.key] === n}
                className={`rate-dot ${scores[s.key] === n ? 'is-on' : ''}`}
                onClick={() => setScores((x) => ({ ...x, [s.key]: n }))}
              >
                {n}
              </button>
            ))}
          </span>
        </div>
      ))}
      <label className="f">
        <span className="f-label">
          Anything future candidates should know? <span className="f-optional">optional</span>
        </span>
        <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="f-error">{error}</p>}
      <div className="joining-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Not now
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!ready || busy} onClick={submit}>
          {busy ? 'Saving…' : 'Send rating'}
        </button>
      </div>
    </div>
  );
}
