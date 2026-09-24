import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { ApiError } from '../../api/client';
import {
  EVENT_LABEL,
  fmtDate,
  fmtDateTime,
  opportunitiesApi,
  toLocalInput,
  type CompanyWeek,
  type EventKind,
  type WeekStatus,
} from '../../api/opportunities';
import { useAuth } from '../../auth/AuthContext';
import '../student/Opportunities.css';

type Data = Awaited<ReturnType<typeof opportunitiesApi.companyWeeks>>;

const STATUS: Record<WeekStatus, { pill: string; label: string }> = {
  PROPOSED: { pill: 'pill-hold', label: 'Waiting for the college' },
  APPROVED: { pill: 'pill-pass', label: 'Approved' },
  DECLINED: { pill: 'pill-stop', label: 'Declined' },
  DONE: { pill: 'pill-idle', label: 'Finished' },
};

interface PlanRow {
  kind: EventKind;
  title: string;
  startsAt: string; // datetime-local value
  durationMin: number;
  where: string;
  simulationId: string;
}

interface Draft {
  collegeId: string;
  title: string;
  message: string;
  startDate: string;
  endDate: string;
  events: PlanRow[];
}

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalInput(d.toISOString()).slice(0, 10);
};

const blankRow = (date: string, kind: EventKind = 'TALK'): PlanRow => ({
  kind,
  title: '',
  startsAt: `${date}T11:00`,
  durationMin: 60,
  where: '',
  simulationId: '',
});

function blankDraft(): Draft {
  const start = day(21);
  return { collegeId: '', title: '', message: '', startDate: start, endDate: day(23), events: [blankRow(start)] };
}

function draftFrom(w: CompanyWeek): Draft {
  return {
    collegeId: w.college.id,
    title: w.title,
    message: w.message ?? '',
    startDate: w.startDate.slice(0, 10),
    endDate: w.endDate.slice(0, 10),
    events: w.events.map((e) => ({
      kind: e.kind,
      title: e.title,
      startsAt: toLocalInput(e.startsAt),
      durationMin: e.durationMin,
      where: e.where ?? '',
      simulationId: e.simulationId ?? '',
    })),
  };
}

/**
 * Campus weeks: propose a few days at a college - talks, a challenge, alumni
 * sessions, interviews. The placement cell approves or declines, and may move
 * a session to fit its timetable. Students register themselves; you see how
 * many, not who. Campus weeks are free - nobody pays anybody on Apli.ai.
 */
export default function CampusWeeks() {
  const { can } = useAuth();
  const mayWrite = can('job:write');
  const [data, setData] = useState<Data | null>(null);
  const [editing, setEditing] = useState<CompanyWeek | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await opportunitiesApi.companyWeeks());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load campus weeks.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function withdraw(w: CompanyWeek) {
    setError(null);
    try {
      await opportunitiesApi.withdrawWeek(w.id);
      setNotice(`Withdrew “${w.title}”.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not withdraw it.');
    }
  }

  const noColleges = data && data.colleges.length === 0;

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Campus weeks</p>
          <h1>Spend a week on campus</h1>
          <p className="page-lede">
            Propose a few days of sessions at a college. Its placement cell decides, and its students sign up.
          </p>
        </div>
        {mayWrite && !editing && !noColleges && (
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            Propose a week
          </button>
        )}
      </header>

      <p className="opp-money">
        <span>
          <strong>Free on both sides.</strong> There is no fee to propose or host a campus week. You see how many students
          registered and attended; to reach individual students, use <Link to="/company/talent">Talent</Link>.
        </span>
      </p>

      {error && <p className="alert alert-error">{error}</p>}
      {notice && <p className="alert alert-ok">{notice}</p>}
      {noColleges && (
        <p className="alert alert-warn">No college on Apli.ai is hosting campus weeks yet. This page fills in when one does.</p>
      )}

      {editing && data && (
        <WeekForm
          week={editing === 'new' ? null : editing}
          colleges={data.colleges}
          simulations={data.simulations}
          onCancel={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setNotice(msg);
            await load();
          }}
        />
      )}

      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.weeks.length === 0 && !editing && !noColleges && (
        <div className="empty">
          <h2>No campus weeks yet.</h2>
          <p>A talk and a short challenge over two days is an easy first week to run.</p>
        </div>
      )}

      {data && data.weeks.length > 0 && (
        <div className="week-list">
          {data.weeks.map((w) => {
            const s = STATUS[w.status];
            const registered = w.events.reduce((n, e) => n + e.registered, 0);
            const attended = w.events.reduce((n, e) => n + e.attended, 0);
            return (
              <section key={w.id} className="opp-card">
                <div className="opp-top">
                  <div>
                    <h3>{w.title}</h3>
                    <span className="opp-company">
                      {w.college.name} · {fmtDate(w.startDate)} to {fmtDate(w.endDate)}
                    </span>
                  </div>
                  <span className={`pill ${s.pill}`}>{s.label}</span>
                </div>
                {w.decisionNote && <p className="opp-quote">From the placement cell: {w.decisionNote}</p>}
                {(w.status === 'APPROVED' || w.status === 'DONE') && (
                  <p className="opp-next">
                    {registered} registration{registered === 1 ? '' : 's'} across all sessions
                    {w.status === 'DONE' || attended > 0 ? ` · ${attended} attended` : ''}. Names stay with the college.
                  </p>
                )}
                <ul className="week-events">
                  {w.events.map((e) => (
                    <li key={e.id} className="week-event">
                      <span className="week-kind">{EVENT_LABEL[e.kind]}</span>
                      <div>
                        <strong>{e.title}</strong>
                        <small>
                          {fmtDateTime(e.startsAt)} · {e.durationMin} min{e.where ? ` · ${e.where}` : ''}
                          {e.simulationId && data.simulations.find((x) => x.id === e.simulationId)
                            ? ` · uses “${data.simulations.find((x) => x.id === e.simulationId)!.title}”`
                            : ''}
                        </small>
                      </div>
                      <small>
                        {e.registered} coming{e.invited > 0 ? ` · ${e.invited} asked` : ''}
                        {e.attended > 0 ? ` · ${e.attended} came` : ''}
                      </small>
                      {mayWrite && w.status === 'APPROVED' && (
                        <InviteApplicants
                          weekId={w.id}
                          eventId={e.id}
                          title={e.title}
                          jobs={data.jobs}
                          preferJobId={e.jobId}
                          onDone={(msg) => {
                            setNotice(msg);
                            void load();
                          }}
                          onError={setError}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {mayWrite && w.status === 'PROPOSED' && (
                  <div className="opp-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(w)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => withdraw(w)}>
                      Withdraw proposal
                    </button>
                  </div>
                )}
                {(w.status === 'APPROVED' || w.status === 'DONE') && (
                  <div className="opp-actions">
                    <Link to="/company/talent" className="btn btn-ghost btn-sm">
                      Find students in Talent
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </CompanyLayout>
  );
}

function WeekForm({
  week,
  colleges,
  simulations,
  onCancel,
  onSaved,
}: {
  week: CompanyWeek | null;
  colleges: Data['colleges'];
  simulations: Data['simulations'];
  onCancel: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [d, setD] = useState<Draft>(week ? draftFrom(week) : blankDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setRow = (i: number, patch: Partial<PlanRow>) =>
    setD((x) => ({ ...x, events: x.events.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input = {
      collegeId: d.collegeId,
      title: d.title.trim(),
      message: d.message.trim(),
      startDate: d.startDate,
      endDate: d.endDate,
      events: d.events.map((r) => ({
        kind: r.kind,
        title: r.title.trim(),
        startsAt: new Date(r.startsAt).toISOString(),
        durationMin: r.durationMin,
        where: r.where.trim(),
        simulationId: r.kind === 'CHALLENGE' ? r.simulationId : '',
      })),
    };
    try {
      if (week) await opportunitiesApi.updateWeek(week.id, input);
      else await opportunitiesApi.proposeWeek(input);
      const college = colleges.find((c) => c.id === d.collegeId)?.name ?? 'the college';
      await onSaved(week ? 'Saved. The college sees the new plan.' : `Sent to ${college}. You will be notified when they decide.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the proposal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-card opp-form" onSubmit={submit} style={{ marginBottom: 18 }}>
      <h2>{week ? 'Edit proposal' : 'Propose a campus week'}</h2>
      <div className="form-row">
        <label className="field">
          <span className="field-label">College</span>
          <select value={d.collegeId} onChange={(e) => setD({ ...d, collegeId: e.target.value })} required disabled={!!week}>
            <option value="">Choose a college</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? `, ${c.city}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">From</span>
          <input type="date" min={day(0)} value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} required />
        </label>
        <label className="field">
          <span className="field-label">To (two weeks at most)</span>
          <input type="date" min={d.startDate} value={d.endDate} onChange={(e) => setD({ ...d, endDate: e.target.value })} required />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Title</span>
        <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={140} required placeholder="e.g. Product week with Demo Co" />
      </label>
      <label className="field">
        <span className="field-label">A note to the placement cell (optional)</span>
        <textarea value={d.message} onChange={(e) => setD({ ...d, message: e.target.value })} maxLength={2000} rows={3} />
      </label>

      <h3 style={{ margin: '12px 0 8px' }}>Sessions</h3>
      {d.events.map((r, i) => (
        <div key={i} className="week-plan-row">
          <label className="field">
            <span className="field-label">Kind</span>
            <select value={r.kind} onChange={(e) => setRow(i, { kind: e.target.value as EventKind })}>
              {(Object.keys(EVENT_LABEL) as EventKind[]).map((k) => (
                <option key={k} value={k}>
                  {EVENT_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">What it is</span>
            <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} maxLength={140} required />
          </label>
          <label className="field">
            <span className="field-label">Starts</span>
            <input type="datetime-local" value={r.startsAt} onChange={(e) => setRow(i, { startsAt: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field-label">Minutes</span>
            <input type="number" min={15} max={480} step={15} value={r.durationMin} onChange={(e) => setRow(i, { durationMin: Number(e.target.value) })} />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Remove this session"
            disabled={d.events.length === 1}
            onClick={() => setD({ ...d, events: d.events.filter((_, j) => j !== i) })}
          >
            ×
          </button>
          {r.kind === 'CHALLENGE' && (
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="field-label">Use one of your published simulations (optional)</span>
              <select value={r.simulationId} onChange={(e) => setRow(i, { simulationId: e.target.value })}>
                <option value="">No simulation - we run it ourselves</option>
                {simulations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ))}
      {d.events.length < 20 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setD({ ...d, events: [...d.events, blankRow(d.startDate)] })}
        >
          + Add a session
        </button>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : week ? 'Save changes' : 'Send to the college'}
        </button>
      </div>
    </form>
  );
}

/**
 * Inviting the people who applied to one of your roles.
 *
 * By role and never by name: you already see who applied to your own job, and
 * this asks them to a session. It does not open a door to anybody else's
 * students, and what comes back is a count, not a list.
 */
function InviteApplicants({
  weekId,
  eventId,
  title,
  jobs,
  preferJobId,
  onDone,
  onError,
}: {
  weekId: string;
  eventId: string;
  title: string;
  jobs: { id: string; title: string }[];
  preferJobId: string | null;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState(preferJobId ?? jobs[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  if (jobs.length === 0) return null;

  if (!open) {
    return (
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        Invite applicants
      </button>
    );
  }

  return (
    <span className="week-invite">
      <select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Which role">
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!jobId || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await opportunitiesApi.inviteApplicants(weekId, eventId, jobId);
            onDone(
              r.invited === 0
                ? 'Everybody who applied had already been asked.'
                : `${r.invited} applicant${r.invited === 1 ? '' : 's'} invited to “${title}”.`,
            );
            setOpen(false);
          } catch (err) {
            onError(err instanceof ApiError ? err.message : 'Could not send those invitations.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Inviting…' : 'Send invitations'}
      </button>
    </span>
  );
}
