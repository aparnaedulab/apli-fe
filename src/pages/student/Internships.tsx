import { useEffect, useState, type FormEvent } from 'react';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import {
  fmtDate,
  internshipApi,
  mondayOf,
  suggestCredits,
  weeksBetween,
  type ImportableOffer,
  type Internship,
  type ProposalInput,
} from '../../api/internships';
import { useAuth } from '../../auth/AuthContext';
import './Internships.css';

const STATUS: Record<Internship['status'], { pill: string; label: string }> = {
  PROPOSED: { pill: 'pill-hold', label: 'Waiting for approval' },
  APPROVED: { pill: 'pill-pass', label: 'Approved' },
  ONGOING: { pill: 'pill-pass', label: 'Under way' },
  COMPLETED: { pill: 'pill-pass', label: 'Completed' },
  REJECTED: { pill: 'pill-stop', label: 'Not approved' },
  WITHDRAWN: { pill: 'pill-idle', label: 'Withdrawn' },
};

/**
 * The student's internships for academic credit.
 *
 * Each card says, in one line, what happens next and whose move it is - the
 * student's (log this week), the college's (approve, review), or the mentor's
 * (evaluate) - so nobody has to work out where an internship is stuck.
 */
export default function Internships() {
  const { hasModule } = useAuth();
  const [items, setItems] = useState<Internship[] | null>(null);
  const [offers, setOffers] = useState<ImportableOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const on = hasModule('compliance.internships');

  async function refresh() {
    try {
      const r = await internshipApi.mine();
      setItems(r.internships);
      setOffers(r.importable);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your internships.');
    }
  }

  useEffect(() => {
    if (on) void refresh();
  }, [on]);

  async function importOffer(o: ImportableOffer) {
    try {
      await internshipApi.importOffer(o.applicationId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that internship.');
    }
  }

  if (!on) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Internships</p>
            <h1>Internships for credit</h1>
            <p className="page-lede">Your institution has not switched this on yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Internships</p>
          <h1>Internships for credit</h1>
          <p className="page-lede">
            Under NEP an internship counts towards your degree. Add it here, your placement cell approves it and sets the
            credits, you log each week, and your mentor sends a short evaluation at the end.
          </p>
        </div>
        {!adding && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            Add an internship
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {offers.map((o) => (
        <div key={o.applicationId} className="alert alert-ok int-offer">
          <span>
            You accepted <b>{o.role}</b> at <b>{o.organisation}</b>. Add it as an internship so it can count for credit.
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => importOffer(o)}>
            Add it
          </button>
        </div>
      ))}

      {adding && (
        <ProposalForm
          title="Add an internship"
          onCancel={() => setAdding(false)}
          onSave={async (data) => {
            await internshipApi.propose(data);
            setAdding(false);
            await refresh();
          }}
        />
      )}

      {items === null && !error && <p className="muted">Loading…</p>}
      {items?.length === 0 && !adding && (
        <div className="empty">
          <h2>No internships yet</h2>
          <p>When you find one, add it here before you start so your college can approve it in time.</p>
        </div>
      )}

      <div className="int-list">
        {items?.map((i) => <InternshipCard key={i.id} i={i} onChange={setItems} onError={setError} />)}
      </div>
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */

function nextStep(i: Internship): string {
  switch (i.status) {
    case 'PROPOSED':
      return 'Your placement cell will approve it and set the credits. You can still change the details until then.';
    case 'APPROVED':
      return `Approved. Log your first week once it starts on ${fmtDate(i.startDate)}.`;
    case 'ONGOING':
      if (!i.hasEnded) return 'Log each week’s work - hours and two or three sentences on what you did.';
      return i.evaluation
        ? 'Your mentor has sent their evaluation. Your placement cell will complete it and record the credits.'
        : 'It has finished. Your mentor has been sent a link to evaluate you - a gentle reminder from you helps.';
    case 'COMPLETED':
      return i.abcSubmittedAt
        ? `Done. Your credits were recorded in your ABC account on ${fmtDate(i.abcSubmittedAt)}.`
        : 'Done. Your placement cell will record the credits in your ABC account.';
    case 'REJECTED':
      return i.decisionNote ? `Not approved: ${i.decisionNote}` : 'Not approved.';
    case 'WITHDRAWN':
      return 'You withdrew this internship.';
  }
}

function InternshipCard({
  i,
  onChange,
  onError,
}: {
  i: Internship;
  onChange: (items: Internship[]) => void;
  onError: (e: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [editLog, setEditLog] = useState<string | null>(null);
  const canLog = (i.status === 'APPROVED' || i.status === 'ONGOING') && new Date(i.startDate).getTime() <= Date.now();
  const pct = i.requiredHours ? Math.min(100, Math.round((i.hoursLogged / i.requiredHours) * 100)) : null;

  if (editing) {
    return (
      <ProposalForm
        title={`Change ${i.organisation}`}
        initial={i}
        onCancel={() => setEditing(false)}
        onSave={async (data) => {
          const r = await internshipApi.editProposal(i.id, data);
          onChange(r.internships);
          setEditing(false);
        }}
      />
    );
  }

  async function withdraw() {
    try {
      onChange((await internshipApi.withdraw(i.id)).internships);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not withdraw it.');
    }
  }

  return (
    <article className={`card int-card is-${i.status.toLowerCase()}`}>
      <div className="int-head">
        <div>
          <h2>{i.role}</h2>
          <p className="muted">
            {i.organisation}
            {i.mode ? ` · ${i.mode}` : ''} · {fmtDate(i.startDate)} – {fmtDate(i.endDate)}
          </p>
        </div>
        <span className={`pill ${STATUS[i.status].pill}`}>{STATUS[i.status].label}</span>
      </div>

      <p className="int-next">{nextStep(i)}</p>

      {(i.status === 'APPROVED' || i.status === 'ONGOING' || i.status === 'COMPLETED') && (
        <div className="int-progress">
          <div className="int-progress-top">
            <span>
              <b>{i.hoursLogged}</b>
              {i.requiredHours ? ` of ${i.requiredHours}` : ''} hours logged
            </span>
            <span className="muted">
              {i.credits !== null ? `${i.credits} credit${i.credits === 1 ? '' : 's'}` : 'Credits not set yet'}
            </span>
          </div>
          {pct !== null && (
            <div className="int-bar" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {i.status === 'COMPLETED' && (
        <p className="int-meta">
          {i.evaluation?.score ? `Mentor’s evaluation: ${i.evaluation.score} / 5. ` : ''}
          {i.certificateUrl && (
            <a href={i.certificateUrl} target="_blank" rel="noreferrer noopener">
              View certificate
            </a>
          )}
        </p>
      )}

      {i.logs.length > 0 && (
        <details className="int-logs">
          <summary>
            {i.logs.length} week{i.logs.length === 1 ? '' : 's'} logged
          </summary>
          <ul>
            {i.logs.map((l) =>
              editLog === l.id ? (
                <li key={l.id}>
                  <LogForm
                    fixedWeek={l.weekStart.slice(0, 10)}
                    initial={{ hours: l.hours, summary: l.summary }}
                    onCancel={() => setEditLog(null)}
                    onSave={async (d) => {
                      onChange((await internshipApi.editLog(i.id, l.id, { hours: d.hours, summary: d.summary })).internships);
                      setEditLog(null);
                    }}
                  />
                </li>
              ) : (
                <li key={l.id}>
                  <div className="int-log-head">
                    <b>Week of {fmtDate(l.weekStart)}</b>
                    <span className="muted">{l.hours} h</span>
                    {l.reviewedAt ? (
                      <span className="pill pill-pass">Reviewed</span>
                    ) : (
                      <button type="button" className="linkish" onClick={() => setEditLog(l.id)}>
                        Edit
                      </button>
                    )}
                  </div>
                  <p>{l.summary}</p>
                  {l.reviewerNote && <p className="int-note">Placement cell: {l.reviewerNote}</p>}
                </li>
              ),
            )}
          </ul>
        </details>
      )}

      {logging && (
        <LogForm
          onCancel={() => setLogging(false)}
          onSave={async (d) => {
            onChange((await internshipApi.addLog(i.id, d)).internships);
            setLogging(false);
          }}
        />
      )}

      <div className="btn-row int-actions">
        {canLog && !logging && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setLogging(true)}>
            Log a week
          </button>
        )}
        {i.status === 'PROPOSED' && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            Change details
          </button>
        )}
        {(i.status === 'PROPOSED' || i.status === 'APPROVED') && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={withdraw}>
            Withdraw
          </button>
        )}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

function ProposalForm({
  title,
  initial,
  onSave,
  onCancel,
}: {
  title: string;
  initial?: Internship;
  onSave: (d: ProposalInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState<ProposalInput>({
    organisation: initial?.organisation ?? '',
    role: initial?.role ?? '',
    mode: initial?.mode ?? 'On site',
    startDate: initial?.startDate.slice(0, 10) ?? '',
    endDate: initial?.endDate.slice(0, 10) ?? '',
    hoursPerWeek: initial?.hoursPerWeek ?? undefined,
    mentorName: initial?.mentorName ?? '',
    mentorEmail: initial?.mentorEmail ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ProposalInput>(k: K, v: ProposalInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const suggestion = suggestCredits(f.hoursPerWeek, f.startDate, f.endDate);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(f);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <form className="card form-card int-form" onSubmit={submit} noValidate>
      <h2>{title}</h2>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="form-row">
        <label className="field">
          <span className="field-label">Organisation</span>
          <input value={f.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="Demo Labs Pvt Ltd" autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <input value={f.role} onChange={(e) => set('role', e.target.value)} placeholder="Data analyst intern" />
        </label>
        <label className="field">
          <span className="field-label">Mode</span>
          <select value={f.mode} onChange={(e) => set('mode', e.target.value)}>
            <option>On site</option>
            <option>Remote</option>
            <option>Hybrid</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span className="field-label">Starts</span>
          <input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Ends</span>
          <input type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Hours a week</span>
          <input
            type="number"
            min={1}
            max={60}
            value={f.hoursPerWeek ?? ''}
            onChange={(e) => set('hoursPerWeek', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="20"
          />
        </label>
      </div>
      {f.startDate && f.endDate && f.endDate >= f.startDate && (
        <p className="int-hint">
          About {weeksBetween(f.startDate, f.endDate)} weeks
          {f.hoursPerWeek ? ` · ${f.hoursPerWeek * weeksBetween(f.startDate, f.endDate)} hours` : ''}
          {suggestion ? ` · usually ${suggestion} credit${suggestion === 1 ? '' : 's'} (your college decides)` : ''}
        </p>
      )}
      <div className="form-row">
        <label className="field">
          <span className="field-label">
            Mentor’s name <span className="muted">optional</span>
          </span>
          <input value={f.mentorName} onChange={(e) => set('mentorName', e.target.value)} placeholder="Demo Mentor" />
        </label>
        <label className="field">
          <span className="field-label">
            Mentor’s work email <span className="muted">for the evaluation at the end</span>
          </span>
          <input
            type="email"
            value={f.mentorEmail}
            onChange={(e) => set('mentorEmail', e.target.value.trim())}
            placeholder="mentor@demo-company.example"
          />
        </label>
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Send for approval'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LogForm({
  fixedWeek,
  initial,
  onSave,
  onCancel,
}: {
  fixedWeek?: string;
  initial?: { hours: number; summary: string };
  onSave: (d: { weekOf: string; hours: number; summary: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [weekOf, setWeekOf] = useState(fixedWeek ?? mondayOf(new Date()));
  const [hours, setHours] = useState(initial?.hours ?? 0);
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({ weekOf, hours, summary });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that week.');
      setBusy(false);
    }
  }

  return (
    <form className="int-log-form" onSubmit={submit} noValidate>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="form-row">
        <label className="field">
          <span className="field-label">Week of</span>
          <input type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)} disabled={Boolean(fixedWeek)} />
        </label>
        <label className="field">
          <span className="field-label">Hours</span>
          <input type="number" min={1} max={80} value={hours || ''} onChange={(e) => setHours(Number(e.target.value))} placeholder="20" />
        </label>
      </div>
      <label className="field">
        <span className="field-label">What you did</span>
        <textarea
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Cleaned the sales data, built a dashboard for the regional team, and presented it on Friday."
        />
      </label>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save week'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
