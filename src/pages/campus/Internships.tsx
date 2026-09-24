import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import {
  fmtDate,
  internshipApi,
  type CollegeInternship,
  type CollegeSummary,
  type MentorLink,
  type Queue,
} from '../../api/internships';
import { useAuth } from '../../auth/AuthContext';
import '../student/Internships.css';

const QUEUES: { key: Queue; label: string; empty: string }[] = [
  { key: 'to_approve', label: 'To approve', empty: 'Nothing waiting. New proposals from students land here.' },
  { key: 'ongoing', label: 'Under way', empty: 'No internships running right now.' },
  { key: 'to_evaluate', label: 'To close', empty: 'Nothing has finished and is waiting to be closed.' },
  { key: 'completed', label: 'Completed', empty: 'No completed internships yet.' },
  { key: 'closed', label: 'Rejected & withdrawn', empty: 'None.' },
];

/**
 * The placement cell's internship desk.
 *
 * A queue per stage, so the officer works through what is waiting on them -
 * approve, read the weeks, close and credit - rather than scanning one long
 * list for rows that need something. Every decision is made in the side panel,
 * next to the facts it rests on.
 */
export default function CampusInternships() {
  const { hasModule, can } = useAuth();
  const on = hasModule('compliance.internships');
  const [queue, setQueue] = useState<Queue>('to_approve');
  const [rows, setRows] = useState<CollegeInternship[] | null>(null);
  const [summary, setSummary] = useState<CollegeSummary | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await internshipApi.college(queue);
      setRows(r.internships);
      setSummary(r.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load internships.');
    }
  }, [queue]);

  useEffect(() => {
    if (on) void load();
  }, [on, load]);

  if (!on) {
    return (
      <CampusLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Placement cell</p>
            <h1>Internships</h1>
            <p className="page-lede">Your institution has not switched internship management on.</p>
          </div>
        </header>
      </CampusLayout>
    );
  }

  const current = QUEUES.find((q) => q.key === queue)!;

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Internships</h1>
          <p className="page-lede">
            Students propose internships for NEP credit. You approve them and set the credits, read their weekly logs,
            and close each one once the mentor has evaluated it.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {summary && (
        <div className="stat-row">
          <Stat label="To approve" value={summary.to_approve} />
          <Stat label="Under way" value={summary.ongoing} />
          <Stat label="Weeks to read" value={summary.logsToReview} />
          <Stat label="Completed" value={summary.completed} />
          <Stat label="Credits awarded" value={summary.creditsAwarded} />
          <Stat label="Hours logged" value={summary.hoursLogged} />
        </div>
      )}

      <div className="tabs" role="tablist">
        {QUEUES.map((q) => (
          <button
            key={q.key}
            type="button"
            role="tab"
            aria-selected={queue === q.key}
            className={`tab ${queue === q.key ? 'is-current' : ''}`}
            onClick={() => {
              setQueue(q.key);
              setOpen(null);
            }}
          >
            {q.label}
            {summary && summary[q.key] > 0 && <span className="tab-count">{summary[q.key]}</span>}
          </button>
        ))}
      </div>

      <div className={`int-split ${open ? 'has-panel' : ''}`}>
        <div>
          {rows === null && <p className="muted">Loading…</p>}
          {rows?.length === 0 && (
            <div className="empty">
              <p>{current.empty}</p>
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Internship</th>
                    <th>Dates</th>
                    <th className="num">Hours</th>
                    <th className="num">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`int-row ${open === r.id ? 'is-open' : ''}`}
                      onClick={() => setOpen(r.id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setOpen(r.id)}
                    >
                      <td>
                        <b>{r.student.name}</b>
                        <div className="muted">{r.student.course ?? r.student.prn ?? ''}</div>
                      </td>
                      <td>
                        {r.role}
                        <div className="muted">{r.organisation}</div>
                      </td>
                      <td className="muted">
                        {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                      </td>
                      <td className="num">
                        {r.hoursLogged}
                        {r.requiredHours ? ` / ${r.requiredHours}` : ''}
                        {r.logs.some((l) => !l.reviewedAt) && <span className="int-dot" title="Weeks to read" />}
                      </td>
                      <td className="num">{r.credits ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {open && (
          <Panel
            key={open}
            id={open}
            mayDecide={can('student:verify')}
            onClose={() => setOpen(null)}
            onChanged={() => void load()}
          />
        )}
      </div>
    </CampusLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Panel({
  id,
  mayDecide,
  onClose,
  onChanged,
}: {
  id: string;
  mayDecide: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [i, setI] = useState<CollegeInternship | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [credits, setCredits] = useState('');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [mentor, setMentor] = useState<MentorLink | null>(null);
  const [cert, setCert] = useState('');
  const [abcDate, setAbcDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    internshipApi
      .collegeOne(id)
      .then((r) => {
        setI(r);
        setCredits(String(r.credits ?? r.suggestedCredits ?? ''));
        setCert(r.certificateUrl ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this internship.'));
  }, [id]);

  async function act(fn: () => Promise<{ internship: CollegeInternship; mentor?: MentorLink | null }>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      setI(r.internship);
      if (r.mentor) setMentor(r.mentor);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (!i) {
    return (
      <aside className="int-panel">
        <p className="muted">{error ?? 'Loading…'}</p>
      </aside>
    );
  }

  const running = i.status === 'APPROVED' || i.status === 'ONGOING';
  const creditsNum = Number(credits);

  return (
    <aside className="int-panel" aria-label={`${i.student.name}'s internship`}>
      <div className="int-panel-head">
        <div>
          <h2>{i.student.name}</h2>
          <p className="muted">
            {i.role} · {i.organisation}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <dl className="int-facts">
        <div>
          <dt>Dates</dt>
          <dd>
            {fmtDate(i.startDate)} – {fmtDate(i.endDate)}
          </dd>
        </div>
        <div>
          <dt>Planned</dt>
          <dd>{i.hoursPerWeek ? `${i.hoursPerWeek} h a week` : 'Not said'}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{i.mode ?? '—'}</dd>
        </div>
        <div>
          <dt>Mentor</dt>
          <dd>{i.mentorName || i.mentorEmail ? [i.mentorName, i.mentorEmail].filter(Boolean).join(' · ') : 'Not given'}</dd>
        </div>
        <div>
          <dt>Logged</dt>
          <dd>
            {i.hoursLogged} h{i.requiredHours ? ` of ${i.requiredHours}` : ''} · {i.logs.length} week
            {i.logs.length === 1 ? '' : 's'}
          </dd>
        </div>
        <div>
          <dt>Credits</dt>
          <dd>{i.credits ?? '—'}</dd>
        </div>
      </dl>

      {error && <p className="alert alert-error">{error}</p>}

      {/* Deciding */}
      {i.status === 'PROPOSED' && mayDecide && (
        <section className="int-block">
          <h3>Decide</h3>
          {!rejecting ? (
            <>
              <label className="field">
                <span className="field-label">
                  Credits <span className="muted">suggested {i.suggestedCredits ?? '—'} at 30 hours each</span>
                </span>
                <input type="number" step={0.5} min={0.5} value={credits} onChange={(e) => setCredits(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">
                  Note to the student <span className="muted">optional</span>
                </span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Approved - log every week." />
              </label>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !(creditsNum > 0)}
                  onClick={() => act(() => internshipApi.decide(i.id, { approve: true, credits: creditsNum, note: note || undefined }))}
                >
                  Approve
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setRejecting(true)}>
                  Reject
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">Why not? The student is shown this.</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
              </label>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !note.trim()}
                  onClick={() => act(() => internshipApi.decide(i.id, { approve: false, note }))}
                >
                  Reject internship
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setRejecting(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* The mentor's link */}
      {mentor && (
        <div className="alert alert-ok int-mentor">
          {mentor.emailed === 'sent'
            ? 'The evaluation link was emailed to the mentor.'
            : 'The mentor has not been emailed - copy the link and send it to them.'}
          <CopyButton text={mentor.link} />
        </div>
      )}
      {running && mayDecide && !i.evaluation && (
        <section className="int-block">
          <h3>Mentor evaluation</h3>
          <p className="muted">
            {i.mentorLinkIssued
              ? 'A link is out with the mentor. Getting a new one makes a fresh link and stops the old one working.'
              : 'No link has been sent yet.'}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() =>
              act(async () => {
                const { mentor: fresh } = await internshipApi.mentorLink(i.id);
                return { internship: await internshipApi.collegeOne(i.id), mentor: fresh };
              })
            }>
            {i.mentorLinkIssued ? 'Get a new link' : 'Get the link'}
          </button>
        </section>
      )}
      {i.evaluation && (
        <section className="int-block">
          <h3>Mentor’s evaluation</h3>
          <p className="int-score">{i.evaluation.score} / 5</p>
          <p>{i.evaluation.note}</p>
          <p className="muted">Received {fmtDate(i.evaluation.at)}</p>
        </section>
      )}

      {/* Weekly logs */}
      <section className="int-block">
        <h3>Weekly logs</h3>
        {i.logs.length === 0 ? (
          <p className="muted">No weeks logged yet.</p>
        ) : (
          <ul className="int-log-list">
            {i.logs.map((l) => (
              <li key={l.id}>
                <div className="int-log-head">
                  <b>Week of {fmtDate(l.weekStart)}</b>
                  <span className="muted">{l.hours} h</span>
                  {l.reviewedAt ? (
                    <span className="pill pill-pass">Read</span>
                  ) : (
                    mayDecide && <LogReview onReview={(n) => act(() => internshipApi.reviewLog(i.id, l.id, n))} />
                  )}
                </div>
                <p>{l.summary}</p>
                {l.reviewerNote && <p className="int-note">Your note: {l.reviewerNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Closing and crediting */}
      {running && mayDecide && (
        <section className="int-block">
          <h3>Close it</h3>
          {!i.evaluation && <p className="alert alert-warn">The mentor has not evaluated it yet. You can still close it.</p>}
          <label className="field">
            <span className="field-label">
              Certificate link <span className="muted">optional</span>
            </span>
            <input value={cert} onChange={(e) => setCert(e.target.value)} placeholder="https://" />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => internshipApi.complete(i.id, cert || undefined))}>
            Mark completed
          </button>
        </section>
      )}

      {i.status === 'COMPLETED' && (
        <section className="int-block">
          <h3>Credits</h3>
          {i.abcSubmittedAt ? (
            <p>
              {i.credits} credit{i.credits === 1 ? '' : 's'} recorded in the student’s ABC account on{' '}
              {fmtDate(i.abcSubmittedAt)}.
            </p>
          ) : mayDecide ? (
            <>
              <div className="form-row">
                <label className="field">
                  <span className="field-label">Credits</span>
                  <input type="number" step={0.5} min={0.5} value={credits} onChange={(e) => setCredits(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Sent to ABC on</span>
                  <input type="date" value={abcDate} onChange={(e) => setAbcDate(e.target.value)} />
                </label>
              </div>
              <p className="muted int-honest">
                Apli.ai does not connect to the ABC portal. Upload the credits there as you normally do, then record it
                here so the student and your reports know it is done.
              </p>
              <div className="btn-row">
                {creditsNum !== i.credits && creditsNum > 0 && (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => act(() => internshipApi.setCredits(i.id, creditsNum))}>
                    Save credits
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || i.credits === null || creditsNum !== i.credits}
                  onClick={() => act(() => internshipApi.markAbc(i.id, abcDate))}
                >
                  Record as sent to ABC
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Waiting for the credits to be recorded.</p>
          )}
          {i.certificateUrl && (
            <p>
              <a href={i.certificateUrl} target="_blank" rel="noreferrer noopener">
                View certificate
              </a>
            </p>
          )}
        </section>
      )}

      {i.status === 'REJECTED' && i.decisionNote && <p className="muted">Rejected: {i.decisionNote}</p>}
    </aside>
  );
}

function LogReview({ onReview }: { onReview: (note?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  if (!open) {
    return (
      <button type="button" className="linkish" onClick={() => setOpen(true)}>
        Mark as read
      </button>
    );
  }
  return (
    <span className="int-review">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note (optional)" autoFocus />
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onReview(note || undefined)}>
        Done
      </button>
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      title={text}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? 'Copied ✓' : 'Copy link'}
    </button>
  );
}
