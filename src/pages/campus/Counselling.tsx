import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import {
  REASONS,
  campusCounsellingApi,
  type CounsellingForCell,
} from '../../api/counselling';
import { ApiError } from '../../api/client';
import './Counselling.css';

/**
 * Students who have asked to talk.
 *
 * The other half of what `atRisk` does. That list is the college looking at
 * students; this one is students putting their hand up, and the difference
 * matters - somebody who asked is already halfway through the hard part.
 *
 * Waiting first, oldest first. A request nobody picks up is worse than no
 * request at all, because the student has been answered by the silence.
 */

const REASON_LABEL = Object.fromEntries(REASONS.map((r) => [r.key, r.label]));

const SAID: Record<string, string> = {
  OPEN: 'Waiting',
  BOOKED: 'Booked',
  DONE: 'Done',
  CLOSED: 'Closed',
};

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function CampusCounselling() {
  const [rows, setRows] = useState<CounsellingForCell[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    campusCounsellingApi
      .list()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load these.'),
      );
  }, []);

  useEffect(load, [load]);

  function say(m: string) {
    setFlash(m);
    window.setTimeout(() => setFlash(null), 4000);
  }

  const waiting = (rows ?? []).filter((r) => r.status === 'OPEN');
  const booked = (rows ?? []).filter((r) => r.status === 'BOOKED');
  const done = (rows ?? []).filter((r) => ['DONE', 'CLOSED'].includes(r.status));

  return (
    <CampusLayout>
      <div className="cc">
        <header className="cc-head">
          <h1>Counselling</h1>
          <p>
            Students who asked to talk. This is not the at-risk list — nobody here was flagged by
            the portal, they put their hand up.
          </p>
        </header>

        {error && <p className="alert alert-error">{error}</p>}
        {flash && <p className="alert alert-ok">{flash}</p>}
        {rows === null && !error && <p className="muted">Loading…</p>}

        {rows?.length === 0 && (
          <div className="empty">
            <h2>Nobody has asked</h2>
            <p>
              A request lands here the moment a student asks for a conversation, with the reason
              attached so you know what you are walking into.
            </p>
          </div>
        )}

        {[
          ['Waiting', waiting],
          ['Booked', booked],
          ['Been and gone', done],
        ].map(([title, list]) =>
          (list as CounsellingForCell[]).length === 0 ? null : (
            <section key={title as string} className="cc-group">
              <h2>
                {title as string}
                <span>{(list as CounsellingForCell[]).length}</span>
              </h2>
              <ul>
                {(list as CounsellingForCell[]).map((r) => (
                  <Row key={r.id} r={r} onDone={load} onSay={say} onError={setError} />
                ))}
              </ul>
            </section>
          ),
        )}
      </div>
    </CampusLayout>
  );
}

/** One request, and what the cell does with it. */
function Row({
  r,
  onDone,
  onSay,
  onError,
}: {
  r: CounsellingForCell;
  onDone: () => void;
  onSay: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [meetAt, setMeetAt] = useState('');
  const [meetWhere, setMeetWhere] = useState(r.meetWhere ?? '');
  const [outcome, setOutcome] = useState(r.outcome ?? '');
  const [busy, setBusy] = useState(false);

  const waited = daysSince(r.createdAt);

  async function save(body: Parameters<typeof campusCounsellingApi.update>[1], said: string) {
    setBusy(true);
    onError('');
    try {
      await campusCounsellingApi.update(r.id, body);
      onSay(said);
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`cc-row is-${r.status.toLowerCase()} ${waited >= 5 && r.status === 'OPEN' ? 'is-late' : ''}`}>
      <div className="cc-top">
        <span className="cc-who">
          <b>{r.candidate.name}</b>
          <small>
            {[r.candidate.batch, r.candidate.email].filter(Boolean).join(' · ')}
          </small>
        </span>
        <span className="cc-reason">{REASON_LABEL[r.reason] ?? r.reason}</span>
        <span className="cc-age">
          {SAID[r.status]}
          {r.status === 'OPEN' && waited > 0 ? ` · ${waited}d` : ''}
        </span>
      </div>

      {/* Their own words, quoted rather than summarised. */}
      {r.note && <p className="cc-note">“{r.note}”</p>}

      {r.status === 'OPEN' && (
        <div className="cc-do">
          <label>
            <span>When</span>
            <input
              type="datetime-local"
              value={meetAt}
              onChange={(e) => setMeetAt(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            <span>Where, or how</span>
            <input
              value={meetWhere}
              onChange={(e) => setMeetWhere(e.target.value)}
              placeholder="Placement office, or a call"
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || meetAt === ''}
            onClick={() =>
              void save(
                { status: 'BOOKED', meetAt: new Date(meetAt).toISOString(), meetWhere },
                `${r.candidate.name} has a time.`,
              )
            }
          >
            Set a time
          </button>
        </div>
      )}

      {r.status === 'BOOKED' && (
        <div className="cc-do is-wide">
          {r.meetAt && (
            <p className="cc-booked">
              {new Date(r.meetAt).toLocaleString('en-IN')}
              {r.meetWhere ? ` · ${r.meetWhere}` : ''}
            </p>
          )}
          <label className="is-wide">
            <span>What you agreed — the student reads this</span>
            <textarea
              rows={3}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Two things to do before the next drive, and when to check back."
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || outcome.trim() === ''}
            onClick={() => void save({ status: 'DONE', outcome }, 'Written down.')}
          >
            Mark it done
          </button>
        </div>
      )}

      {r.status === 'DONE' && r.outcome && <p className="cc-outcome">{r.outcome}</p>}
    </li>
  );
}
