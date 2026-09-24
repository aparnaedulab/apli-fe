import { useState } from 'react';
import type { TrackedApplication, TimelineEntry, Waiting } from '../api/tracker';
import './TrackerView.css';

/**
 * The pieces of the live tracker, shared by the student's page and the
 * recruiter's, so both are looking at the same picture of the same facts.
 */

const STATE_LABEL: Record<string, string> = {
  passed: 'Cleared',
  current: 'You are here',
  upcoming: 'Coming up',
  failed: 'Did not clear',
  skipped: 'Skipped',
};

/** The rounds as steps: cleared ones ticked, the current one lit, a failed one marked. */
export function Stepper({
  rounds,
  audience = 'student',
}: {
  rounds: TrackedApplication['rounds'];
  audience?: 'student' | 'company';
}) {
  if (rounds.length === 0) return <p className="muted tk-none">This role has no rounds.</p>;
  return (
    <ol className="tk-steps" aria-label="Rounds">
      {rounds.map((r) => (
        <li key={r.id} className={`tk-step is-${r.state}`}>
          <span className="tk-dot" aria-hidden="true">
            {r.state === 'passed' ? '✓' : r.state === 'failed' ? '✕' : r.order}
          </span>
          <span className="tk-name">{r.name}</span>
          <span className="tk-state">
            {audience === 'company' && r.state === 'current' ? 'Current round' : STATE_LABEL[r.state]}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * "Waiting on X for N days". Amber once past the college's response time,
 * and said plainly that the college sees it too - the point is that the
 * student is not the only one who knows.
 */
export function WaitingNote({
  waiting,
  company,
  audience = 'student',
}: {
  waiting: Waiting | null;
  company: string;
  audience?: 'student' | 'company';
}) {
  if (!waiting) return null;
  const days = `${waiting.daysWaiting} day${waiting.daysWaiting === 1 ? '' : 's'}`;
  if (audience === 'company') {
    return waiting.overdue ? (
      <p className="tk-wait is-overdue">
        <b>Overdue.</b> Waiting on you for {days} - the college asks for a move within {waiting.responseDays}. The
        student and their placement cell can both see this.
      </p>
    ) : (
      <p className="tk-wait">
        Waiting on you for {days}. The college’s response time is {waiting.responseDays} days.
      </p>
    );
  }
  return waiting.overdue ? (
    <p className="tk-wait is-overdue">
      <b>Waiting on {company} for {days}.</b> That is longer than your college’s {waiting.responseDays}-day response time,
      and your placement cell can see it too.
    </p>
  ) : (
    <p className="tk-wait">
      Waiting on {company} for {days}
      {waiting.daysWaiting === 0 ? ' (since today)' : ''}. Companies are asked to move within {waiting.responseDays} days.
    </p>
  );
}

/** The history, oldest first, folded away until asked for. */
export function Timeline({ entries, open: startOpen = false }: { entries: TimelineEntry[]; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const latest = entries[entries.length - 1];
  return (
    <div className="tk-timeline">
      <button type="button" className="tk-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Hide history' : `History · ${entries.length} update${entries.length === 1 ? '' : 's'}`}
        {!open && latest && <span className="muted"> · latest: {latest.text.toLowerCase()}</span>}
      </button>
      {open && (
        <ol className="tk-events">
          {entries.map((e, i) => (
            <li key={i} className={`tk-event is-${e.kind}`}>
              <time dateTime={e.at}>
                {new Date(e.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </time>
              <span>
                {e.text}
                {e.note && <span className="tk-note">“{e.note}”</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
