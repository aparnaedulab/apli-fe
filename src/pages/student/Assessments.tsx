import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { assessmentApi, type AssessmentRow, type AssessmentStatus } from '../../api/assessments';
import { notificationApi } from '../../api/notifications';
import { ApiError } from '../../api/client';
import { ApliFace } from './Apli';
import './Assessments.css';

/**
 * Assessments.
 *
 * Tests a company or a college has asked this student to sit. Assigned, never
 * requested: nobody browses a catalogue and applies for a test, because a
 * company does not publish one and wait for volunteers.
 *
 * Apli does not host the questions, so most of these are taken on the
 * company's own platform and the student comes back with a reference. The
 * page is honest about that rather than pretending otherwise - and what it
 * adds is the thing that was missing entirely: one list of what is owed, what
 * is waiting on somebody else, and what has already gone by.
 */

/** Ordered the way a student cares: what is owed, then what is settled. */
const ORDER: AssessmentStatus[] = ['ASSIGNED', 'SUBMITTED', 'PASSED', 'FAILED', 'MISSED'];

const SAID: Record<AssessmentStatus, string> = {
  ASSIGNED: 'To do',
  SUBMITTED: 'Sent — waiting on them',
  PASSED: 'Cleared',
  FAILED: 'Not cleared',
  MISSED: 'The date went by',
};

const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

function whenOf(iso: string): string {
  const d = daysTo(iso);
  const on = new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (d < 0) return on;
  if (d === 0) return `${on} — today`;
  if (d === 1) return `${on} — tomorrow`;
  return `${on} — ${d} days`;
}

export default function Assessments() {
  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    assessmentApi
      .mine()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your assessments.'),
      );
  }, []);

  useEffect(load, [load]);

  /*
   * Opening this page is reading the news on it.
   *
   * Every one of these notifications says "you have a test to sit", and the
   * test is on the screen in front of them - so leaving a badge up afterwards
   * would be the portal nagging about something already done.
   */
  useEffect(() => {
    notificationApi
      .assessmentUpdates()
      .then((all) => {
        const unread = all.filter((n) => !n.readAt).map((n) => n.id);
        if (unread.length > 0) void notificationApi.markRead(unread);
      })
      .catch(() => undefined);
  }, []);

  const owed = useMemo(() => (rows ?? []).filter((r) => r.status === 'ASSIGNED'), [rows]);
  const grouped = useMemo(() => {
    const by = new Map<AssessmentStatus, AssessmentRow[]>();
    for (const r of rows ?? []) {
      if (!by.has(r.status)) by.set(r.status, []);
      by.get(r.status)!.push(r);
    }
    return ORDER.filter((s) => by.has(s)).map((s) => ({ status: s, rows: by.get(s)! }));
  }, [rows]);

  function say(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 4000);
  }

  return (
    <StudentLayout>
      <div className="as">
        <header className="as-head">
          <h1>Assessments</h1>
          <p>
            Tests a company or your college has asked you to sit. They are set for you — there is
            nothing here to apply for.
          </p>
        </header>

        {error && <p className="alert alert-error">{error}</p>}
        {flash && <p className="alert alert-ok">{flash}</p>}
        {rows === null && !error && <p className="muted">Loading…</p>}

        {rows?.length === 0 && (
          <div className="as-empty">
            <ApliFace mood="think" size={54} />
            <h2>Nothing to sit</h2>
            <p>
              A test appears here the moment a company or your college sets one for you. Until then
              there is nothing owed.
            </p>
            <Link className="btn btn-primary" to="/student/jobs">
              See what is open
            </Link>
          </div>
        )}

        {rows && rows.length > 0 && (
          <>
            {/* The one line worth reading before anything else. */}
            <p className="as-apli">
              <ApliFace mood={owed.length > 0 ? 'nudge' : 'cheer'} size={34} />
              <span>
                {owed.length === 0
                  ? 'Nothing owed. Everything set for you has been sent back.'
                  : owed.length === 1
                    ? 'One test is waiting on you.'
                    : `${owed.length} tests are waiting on you.`}
              </span>
            </p>

            {grouped.map((g) => (
              <section key={g.status} className="as-group">
                <h2>
                  {SAID[g.status]}
                  <span>{g.rows.length}</span>
                </h2>
                <ul>
                  {g.rows.map((r) => (
                    <Row key={r.id} r={r} onDone={load} onSay={say} onError={setError} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </StudentLayout>
  );
}

/**
 * One test.
 *
 * Open, sit it, come back with whatever the platform gave you. The reference
 * box is free text because every external platform names its own thing
 * differently, and asking a student to produce a format nobody told them is
 * how a required test quietly goes unsubmitted.
 */
function Row({
  r,
  onDone,
  onSay,
  onError,
}: {
  r: AssessmentRow;
  onDone: () => void;
  onSay: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [ref, setRef] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const a = r.assessment;
  const late = r.status === 'MISSED';

  async function run(fn: () => Promise<unknown>, said: string) {
    setBusy(true);
    onError('');
    try {
      await fn();
      onSay(said);
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`as-row is-${r.status.toLowerCase()}`}>
      <div className="as-row-top">
        <div className="as-what">
          <b>{a.title}</b>
          <small>
            {a.setBy}
            {r.application ? ` · ${r.application.jobTitle}` : ''}
            {a.durationMin ? ` · ${a.durationMin} minutes` : ''}
            {r.attempt > 1 ? ` · attempt ${r.attempt}` : ''}
          </small>
        </div>

        {/*
          Whether anybody watched. The label, not proctoring - and it is here
          because a recruiter reading the score will weigh it by exactly this.
        */}
        <span className={`as-watch ${a.supervised ? 'is-on' : ''}`}>
          {a.supervised ? 'Supervised' : 'Unsupervised'}
        </span>

        {r.dueAt && (
          <span className={`as-due ${late ? 'is-late' : daysTo(r.dueAt) <= 2 ? 'is-soon' : ''}`}>
            {whenOf(r.dueAt)}
          </span>
        )}
      </div>

      {a.instructions && <p className="as-note">{a.instructions}</p>}

      {/* The result, once somebody has recorded one. A score with no words
          beside it is a number nobody can argue with. */}
      {(r.score !== null || r.feedback) && (
        <p className="as-result">
          {r.score !== null && (
            <b>
              {r.score}
              {r.maxScore ? ` / ${r.maxScore}` : ''}
            </b>
          )}
          {r.feedback && <span>{r.feedback}</span>}
        </p>
      )}

      {r.submittedRef && (
        <p className="as-sent">
          You sent: <code>{r.submittedRef}</code>
        </p>
      )}

      <div className="as-do">
        {a.url && r.status === 'ASSIGNED' && (
          <a className="btn btn-primary btn-sm" href={a.url} target="_blank" rel="noreferrer">
            Take the test
          </a>
        )}

        {r.status === 'ASSIGNED' && (
          <>
            {open ? (
              <span className="as-ref">
                <input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="Reference, link or score they gave you"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy || ref.trim() === ''}
                  onClick={() =>
                    void run(
                      () => assessmentApi.submit(r.id, ref.trim()),
                      'Sent. They will record the result.',
                    )
                  }
                >
                  Send it
                </button>
              </span>
            ) : (
              <button type="button" className="link-btn" onClick={() => setOpen(true)}>
                I have taken it
              </button>
            )}
          </>
        )}

        {/* The one place an approval belongs, and it is a rule rather than an
            inbox: the assessment says how many attempts there are. */}
        {['FAILED', 'MISSED'].includes(r.status) && a.retakes > 0 && (
          <button
            type="button"
            className="link-btn"
            disabled={busy}
            onClick={() => void run(() => assessmentApi.retake(r.id), 'Another attempt is open.')}
          >
            Sit it again
          </button>
        )}

        {a.url && r.status !== 'ASSIGNED' && (
          <a className="as-open" href={a.url} target="_blank" rel="noreferrer">
            Open the test
          </a>
        )}
      </div>
    </li>
  );
}
