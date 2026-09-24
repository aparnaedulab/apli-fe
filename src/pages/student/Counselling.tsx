import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import {
  REASONS,
  counsellingApi,
  type CounsellingReason,
  type CounsellingRequest,
} from '../../api/counselling';
import { studentJobsApi, type MyApplication } from '../../api/candidate';
import { ApiError } from '../../api/client';
import { ApliFace } from './Apli';
import './Counselling.css';

/**
 * Career counselling.
 *
 * The asking is the student's, and nothing on this page flags anybody. The
 * portal already knows who has stalled - `atRisk` works it out and tells the
 * college - and it deliberately never shows a student those words. A page
 * that said "you have had three rejections, shall we talk?" would be the same
 * verdict in a softer voice.
 *
 * So the two prompts here are drawn from facts the student can already see on
 * their own applications page, and they are offers rather than assessments.
 * Anybody can ask, at any time, for any of the six reasons.
 */

/** What it says while it is going on. */
const SAID: Record<string, string> = {
  OPEN: 'Waiting for the cell to pick it up',
  BOOKED: 'A time has been set',
  DONE: 'Happened',
  CLOSED: 'Closed',
};

const REASON_LABEL = Object.fromEntries(REASONS.map((r) => [r.key, r.label]));

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function Counselling() {
  const [requests, setRequests] = useState<CounsellingRequest[] | null>(null);
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [asking, setAsking] = useState<CounsellingReason | null>(null);

  const load = useCallback(() => {
    counsellingApi
      .mine()
      .then(setRequests)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load this.'),
      );
    studentJobsApi.applications().then(setApps).catch(() => setApps([]));
  }, []);

  useEffect(load, [load]);

  /*
   * The two moments that actually need a conversation, drawn from what the
   * student can already see on their own applications page. Offers of help,
   * never a verdict - and each one only ever appears when it is true.
   */
  const prompts = useMemo(() => {
    const out: { reason: CounsellingReason; line: string }[] = [];

    const offers = apps.filter((a) => a.status === 'OFFERED');
    if (offers.length > 1) {
      out.push({
        reason: 'OFFER_CHOICE',
        line: `You have ${offers.length} offers open. Answering one closes the others, and that cannot be undone.`,
      });
    }

    // Said as a quiet spell rather than as a count of refusals.
    const live = apps.filter((a) =>
      ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'IN_ROUND', 'WAITLISTED'].includes(a.status),
    );
    const quiet = live.length > 0 ? Math.min(...live.map((a) => daysSince(a.lastEventAt))) : 0;
    if (live.length >= 3 && quiet >= 21 && offers.length === 0) {
      out.push({
        reason: 'NOT_SHORTLISTED',
        line: 'Nothing has moved on your applications for a few weeks. Somebody who reads applications for a living can usually see why.',
      });
    }

    return out;
  }, [apps]);

  const open = (requests ?? []).filter((r) => ['OPEN', 'BOOKED'].includes(r.status));
  const past = (requests ?? []).filter((r) => ['DONE', 'CLOSED'].includes(r.status));

  async function ask(reason: CounsellingReason, note: string) {
    setError(null);
    try {
      await counsellingApi.ask(reason, note || undefined);
      setAsking(null);
      setFlash('Asked. Your placement cell will pick it up.');
      window.setTimeout(() => setFlash(null), 5000);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not send.');
    }
  }

  return (
    <StudentLayout>
      <div className="cn">
        <header className="cn-head">
          <h1>Career counselling</h1>
          <p>
            A conversation with somebody at your placement cell, when the decision is not obvious.
            You ask; nothing here is assigned to you.
          </p>
        </header>

        {error && <p className="alert alert-error">{error}</p>}
        {flash && <p className="alert alert-ok">{flash}</p>}

        {/* Only ever on the page when it is true of them. */}
        {prompts.map((p) => (
          <section key={p.reason} className="cn-now">
            <ApliFace mood="think" size={34} />
            <div>
              <p>{p.line}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAsking(p.reason)}>
                Talk it through
              </button>
            </div>
          </section>
        ))}

        {/* What is already in hand. */}
        {open.length > 0 && (
          <section className="cn-open">
            <h2>Asked for</h2>
            <ul>
              {open.map((r) => (
                <li key={r.id}>
                  <div className="cn-what">
                    <b>{REASON_LABEL[r.reason] ?? r.reason}</b>
                    <small>
                      {SAID[r.status]}
                      {r.counsellor ? ` · ${r.counsellor.fullName}` : ''}
                    </small>
                    {r.status === 'BOOKED' && r.meetAt && (
                      <span className="cn-when">
                        {when(r.meetAt)}
                        {r.meetWhere ? ` · ${r.meetWhere}` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="link-btn is-danger"
                    onClick={() =>
                      void counsellingApi
                        .close(r.id)
                        .then(load)
                        .catch(() => setError('That did not work.'))
                    }
                  >
                    Withdraw
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Asking. Six reasons rather than an empty box: a student who has to
            compose the question often does not ask at all. */}
        <section className="cn-ask">
          <h2>What would you like to talk about?</h2>
          <ul className="cn-reasons">
            {REASONS.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  className={`cn-reason ${asking === r.key ? 'is-on' : ''}`}
                  onClick={() => setAsking(asking === r.key ? null : r.key)}
                  aria-expanded={asking === r.key}
                >
                  <b>{r.label}</b>
                  <small>{r.hint}</small>
                </button>
              </li>
            ))}
          </ul>

          {asking && <AskBox reason={asking} onSend={ask} onCancel={() => setAsking(null)} />}
        </section>

        {/* What was agreed, kept. A conversation that leaves no record cannot
            be followed up, and the student cannot hold anybody to it. */}
        {past.length > 0 && (
          <section className="cn-past">
            <h2>What was agreed</h2>
            <ul>
              {past.map((r) => (
                <li key={r.id}>
                  <b>{REASON_LABEL[r.reason] ?? r.reason}</b>
                  <small>
                    {new Date(r.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                    })}
                    {r.counsellor ? ` · ${r.counsellor.fullName}` : ''}
                  </small>
                  {r.outcome ? (
                    <p>{r.outcome}</p>
                  ) : (
                    <p className="muted">Closed without a conversation.</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          The line this page does not cross.

          A placement portal is not a counselling service, and a booking form
          in a job app is no place for somebody in real distress. Saying so,
          permanently and without being asked, is the only honest thing to do
          with the space.
        */}
        <p className="cn-else">
          This is about work and what comes after college. If what you are carrying is heavier than
          that, your college has people whose actual job it is — ask the office for them, and please
          do ask.
        </p>

        {requests !== null && requests.length === 0 && prompts.length === 0 && (
          <p className="cn-quiet">
            Nothing asked for yet. <Link to="/student/applications">Your applications</Link> are a
            reasonable place to look first.
          </p>
        )}
      </div>
    </StudentLayout>
  );
}

/** The note, once a reason is picked. */
function AskBox({
  reason,
  onSend,
  onCancel,
}: {
  reason: CounsellingReason;
  onSend: (reason: CounsellingReason, note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="cn-box">
      <label>
        <span>Anything you want them to know first? Optional.</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="One or two lines is plenty."
          disabled={busy}
        />
      </label>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onSend(reason, note.trim());
          }}
        >
          {busy ? 'Asking…' : 'Ask for a conversation'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
