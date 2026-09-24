import { useCallback, useEffect, useState, type FormEvent } from 'react';
import CompanyLayout from './CompanyLayout';
import { ApiError } from '../../api/client';
import {
  fmtDate,
  opportunitiesApi,
  rupees,
  type MicroApplication,
  type MicroApplicationStatus,
  type MicroProject,
  type MicroProjectStatus,
  type ProjectInput,
  type StudentBasics,
} from '../../api/opportunities';
import { useAuth } from '../../auth/AuthContext';
import '../student/Opportunities.css';

type Applicant = MicroApplication & { student: StudentBasics };

const PROJECT_PILL: Record<MicroProjectStatus, { pill: string; label: string }> = {
  DRAFT: { pill: 'pill-idle', label: 'Draft - not visible' },
  OPEN: { pill: 'pill-pass', label: 'Open' },
  CLOSED: { pill: 'pill-hold', label: 'Closed to new applications' },
  COMPLETED: { pill: 'pill-idle', label: 'Finished' },
};

const APP_PILL: Record<MicroApplicationStatus, { pill: string; label: string }> = {
  APPLIED: { pill: 'pill-hold', label: 'New' },
  SELECTED: { pill: 'pill-pass', label: 'Chosen - working' },
  REJECTED: { pill: 'pill-idle', label: 'Not chosen' },
  DELIVERED: { pill: 'pill-hold', label: 'Handed in - review it' },
  COMPLETED: { pill: 'pill-pass', label: 'Completed' },
  WITHDRAWN: { pill: 'pill-idle', label: 'Withdrew' },
};

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const BLANK: ProjectInput = { title: '', brief: '', hours: 20, stipend: 5000, skills: [], slots: 1, deadline: inDays(14) };

/**
 * Micro-internships: a short, paid brief that students do for you.
 *
 * Write the brief, open it, choose up to the number of places, review what
 * is handed in and rate it, then record that you paid. The stipend goes from
 * you to the student directly - Apli.ai does not collect or pass on money.
 */
export default function MicroProjects() {
  const { can } = useAuth();
  const mayWrite = can('job:write');
  const mayDecide = can('application:advance');

  const [projects, setProjects] = useState<MicroProject[] | null>(null);
  const [editing, setEditing] = useState<MicroProject | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProjects(await opportunitiesApi.companyProjects());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your projects.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(p: MicroProject, status: 'OPEN' | 'CLOSED' | 'COMPLETED') {
    setError(null);
    try {
      await opportunitiesApi.setProjectStatus(p.id, status);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the status.');
    }
  }

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Micro-internships</p>
          <h1>Short paid projects</h1>
          <p className="page-lede">
            Give students 10 to 40 hours of real work. You see how they work before you hire, and they leave with a
            rated piece of work.
          </p>
        </div>
        {mayWrite && !editing && (
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            New project
          </button>
        )}
      </header>

      <p className="opp-money">
        <span>
          <strong>Paying the stipend:</strong> you pay the student directly, the way you would pay any contractor.
          Apli.ai does not collect, hold or pass on money. Mark it paid here once done, and the student confirms they
          received it.
        </span>
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      {editing && (
        <ProjectForm
          project={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {!projects && !error && <p className="muted">Loading…</p>}
      {projects && projects.length === 0 && !editing && (
        <div className="empty">
          <h2>No projects yet.</h2>
          <p>A good first brief is something a strong final-year student can finish in two weekends.</p>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="week-list">
          {projects.map((p) => {
            const s = PROJECT_PILL[p.status];
            const fresh = p.counts?.APPLIED ?? 0;
            const toReview = p.counts?.DELIVERED ?? 0;
            return (
              <section key={p.id} className="opp-card">
                <div className="opp-top">
                  <div>
                    <h3>{p.title}</h3>
                    <span className="opp-company">
                      {rupees(p.stipend)} · {p.hours} h · {p.taken} of {p.slots} place{p.slots === 1 ? '' : 's'} filled ·
                      applications close {fmtDate(p.deadline)}
                    </span>
                  </div>
                  <span className={`pill ${s.pill}`}>{s.label}</span>
                </div>
                {(fresh > 0 || toReview > 0) && (
                  <p className="opp-next">
                    {[fresh > 0 && `${fresh} new application${fresh === 1 ? '' : 's'}`, toReview > 0 && `${toReview} handed in to review`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <div className="opp-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                    {openId === p.id ? 'Hide applicants' : 'Applicants'}
                  </button>
                  {mayWrite && (p.status === 'DRAFT' || p.status === 'OPEN') && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                  )}
                  {mayWrite && (p.status === 'DRAFT' || p.status === 'CLOSED') && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'OPEN')}>
                      {p.status === 'DRAFT' ? 'Open to students' : 'Reopen'}
                    </button>
                  )}
                  {mayWrite && p.status === 'OPEN' && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'CLOSED')}>
                      Stop taking applications
                    </button>
                  )}
                  {mayWrite && (p.status === 'OPEN' || p.status === 'CLOSED') && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'COMPLETED')}>
                      Mark finished
                    </button>
                  )}
                </div>
                {openId === p.id && <Applicants projectId={p.id} mayDecide={mayDecide} onChanged={load} />}
              </section>
            );
          })}
        </div>
      )}
    </CompanyLayout>
  );
}

function ProjectForm({
  project,
  onCancel,
  onSaved,
}: {
  project: MicroProject | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ProjectInput>(
    project
      ? {
          title: project.title,
          brief: project.brief,
          hours: project.hours,
          stipend: project.stipend,
          skills: project.skills,
          slots: project.slots,
          deadline: project.deadline.slice(0, 10),
        }
      : BLANK,
  );
  const [skills, setSkills] = useState((project?.skills ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data: ProjectInput = {
      ...form,
      title: form.title.trim(),
      brief: form.brief.trim(),
      skills: skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12),
      // End of the chosen day, so "apply by 20 Oct" includes 20 Oct.
      deadline: new Date(`${form.deadline}T23:59:00`).toISOString(),
    };
    try {
      if (project) await opportunitiesApi.updateProject(project.id, data);
      else await opportunitiesApi.createProject(data);
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the project.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-card opp-form" onSubmit={submit} style={{ marginBottom: 18 }}>
      <h2>{project ? 'Edit project' : 'New project'}</h2>
      {!project && <p className="muted">It is saved as a draft. Students see it only after you open it.</p>}
      <label className="field">
        <span className="field-label">Title</span>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={140} required placeholder="e.g. Clean up our onboarding emails" />
      </label>
      <label className="field">
        <span className="field-label">The brief - what to make, what you will give them, what good looks like</span>
        <textarea value={form.brief} onChange={(e) => set('brief', e.target.value)} maxLength={5000} rows={6} required />
        <div className="opp-count">{form.brief.trim().length < 40 ? `At least 40 characters (${form.brief.trim().length})` : `${form.brief.length} / 5000`}</div>
      </label>
      <div className="form-row">
        <label className="field">
          <span className="field-label">Hours of work (10-40)</span>
          <input type="number" min={10} max={40} value={form.hours} onChange={(e) => set('hours', Number(e.target.value))} required />
        </label>
        <label className="field">
          <span className="field-label">Stipend in ₹ (paid by you)</span>
          <input type="number" min={1} step={1} value={form.stipend} onChange={(e) => set('stipend', Number(e.target.value))} required />
        </label>
        <label className="field">
          <span className="field-label">Places</span>
          <input type="number" min={1} max={50} value={form.slots} onChange={(e) => set('slots', Number(e.target.value))} required />
        </label>
        <label className="field">
          <span className="field-label">Applications close</span>
          <input type="date" min={inDays(1)} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} required />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Skills it needs (comma separated)</span>
        <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. Copywriting, Figma" />
      </label>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : project ? 'Save changes' : 'Save as draft'}
        </button>
      </div>
    </form>
  );
}

function Applicants({ projectId, mayDecide, onChanged }: { projectId: string; mayDecide: boolean; onChanged: () => Promise<void> }) {
  const [apps, setApps] = useState<Applicant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setApps((await opportunitiesApi.projectDetail(projectId)).applications);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load applicants.');
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await Promise.all([load(), onChanged()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    }
  }

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!apps) return <p className="muted">Loading applicants…</p>;
  if (apps.length === 0) return <p className="muted">No applications yet.</p>;

  return (
    <div className="opp-apps">
      {apps.map((a) => (
        <ApplicantRow key={a.id} a={a} mayDecide={mayDecide} run={run} />
      ))}
    </div>
  );
}

function ApplicantRow({ a, mayDecide, run }: { a: Applicant; mayDecide: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const s = APP_PILL[a.status];
  const st = a.student;

  return (
    <div className="opp-app">
      <div className="opp-app-head">
        <div>
          <strong>{st.name}</strong>
          {st.verified && <span className="pill pill-pass" style={{ marginLeft: 8 }}>Verified by college</span>}
          <small>
            {[st.course, st.specialisation, st.graduationYear && `Class of ${st.graduationYear}`, st.college?.name].filter(Boolean).join(' · ')}
          </small>
        </div>
        <span className={`pill ${s.pill}`}>{s.label}</span>
      </div>
      {st.skills.length > 0 && (
        <div className="opp-skills">
          {st.skills.slice(0, 8).map((k) => (
            <span key={k} className="opp-skill">
              {k}
            </span>
          ))}
        </div>
      )}
      <p className="opp-quote">{a.pitch}</p>
      {a.deliverable && (
        <>
          <strong style={{ fontSize: 13.5 }}>What they handed in</strong>
          <p className="opp-quote">{a.deliverable}</p>
        </>
      )}

      {mayDecide && a.status === 'APPLIED' && (
        <div className="opp-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => opportunitiesApi.decide(a.id, 'SELECT'))}>
            Choose
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => opportunitiesApi.decide(a.id, 'REJECT'))}>
            Not this time
          </button>
        </div>
      )}

      {mayDecide && a.status === 'DELIVERED' && (
        <div className="opp-form">
          <span className="field-label">Rate the work</span>
          <div className="opp-stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} className={n <= rating ? 'is-on' : ''} onClick={() => setRating(n)}>
                {n}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">A short review - the student sees it, and it goes on their record</span>
            <textarea value={review} onChange={(e) => setReview(e.target.value)} maxLength={1000} />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={rating === 0 || review.trim().length < 10}
              onClick={() => run(() => opportunitiesApi.complete(a.id, rating, review.trim()))}
            >
              Accept and complete
            </button>
          </div>
        </div>
      )}

      {a.status === 'COMPLETED' && (
        <>
          {a.rating && (
            <p className="muted">
              You rated this {a.rating} of 5{a.review ? ` - “${a.review}”` : ''}
            </p>
          )}
          {a.paidAt ? (
            <p className="opp-next">
              You marked it paid on {fmtDate(a.paidAt)}.{' '}
              {a.paymentConfirmedAt ? `The student confirmed receiving it on ${fmtDate(a.paymentConfirmedAt)}.` : 'Waiting for the student to confirm they received it.'}
            </p>
          ) : (
            mayDecide && (
              <div className="opp-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => opportunitiesApi.markPaid(a.id))}>
                  I have paid the stipend
                </button>
                <span className="muted">Pay the student directly first, then record it here.</span>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
