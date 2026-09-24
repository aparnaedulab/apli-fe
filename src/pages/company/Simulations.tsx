import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { ApiError } from '../../api/client';
import {
  proofApi,
  type CompanySimulation,
  type CompanySimulationRow,
  type EnrolmentStatus,
  type QueueRow,
  type ReviewEnrolment,
  type SimulationInput,
} from '../../api/proof';
import { useAuth } from '../../auth/AuthContext';
import './Simulations.css';

const ENROL: Record<EnrolmentStatus, { label: string; pill: string }> = {
  IN_PROGRESS: { label: 'Working on it', pill: 'pill-idle' },
  SUBMITTED: { label: 'Ready to read', pill: 'pill-hold' },
  EXPLAIN_BOOKED: { label: 'Call booked', pill: 'pill-hold' },
  NEEDS_WORK: { label: 'Sent back', pill: 'pill-stop' },
  COMPLETED: { label: 'Completed', pill: 'pill-pass' },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * /company/simulations - build short projects, and review the work students send.
 *
 * Two tabs on one page. "Your simulations" is authoring; "Review" is the queue
 * of work waiting on the company. A review never ends on reading alone: the
 * company books a short explain-your-work call, and only after it can the
 * work be marked complete.
 */
export default function Simulations() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'review' ? 'review' : 'build';
  const editing = params.get('edit');
  const reviewing = params.get('review');

  const go = (next: Record<string, string>) => setParams(next);

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Work simulations</p>
          <h1>Let students show you real work.</h1>
          <p className="page-lede">
            A short project in your own words. Students who finish it and explain it on a call earn a certificate you can
            trust - it appears on their skills passport.
          </p>
        </div>
      </header>

      <div className="seg sims-tabs" role="tablist" aria-label="Simulations">
        <button type="button" role="tab" aria-selected={tab === 'build'} className={`seg-opt ${tab === 'build' ? 'is-on' : ''}`} onClick={() => go({})}>
          Your simulations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'review'}
          className={`seg-opt ${tab === 'review' ? 'is-on' : ''}`}
          onClick={() => go({ tab: 'review' })}
        >
          Review
        </button>
      </div>

      {tab === 'build' ? (
        editing ? (
          <Editor id={editing === 'new' ? null : editing} onDone={() => go({})} />
        ) : (
          <Library onEdit={(id) => go({ edit: id })} />
        )
      ) : reviewing ? (
        <Review id={reviewing} onBack={() => go({ tab: 'review' })} />
      ) : (
        <Queue onOpen={(id) => go({ tab: 'review', review: id })} />
      )}
    </CompanyLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Library                                                                     */
/* -------------------------------------------------------------------------- */

function Library({ onEdit }: { onEdit: (id: string) => void }) {
  const { can } = useAuth();
  const [rows, setRows] = useState<CompanySimulationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    proofApi
      .companyList()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load simulations.'));
  }, []);

  return (
    <section>
      <div className="sims-bar">
        <span className="muted">{rows ? `${rows.length} simulation${rows.length === 1 ? '' : 's'}` : ''}</span>
        {can('job:write') && (
          <button type="button" className="btn btn-primary" onClick={() => onEdit('new')}>
            + New simulation
          </button>
        )}
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {rows && rows.length === 0 && (
        <div className="empty">
          <h2>No simulations yet.</h2>
          <p>Start with one task a new joiner would do in their first week. Four hours is plenty.</p>
        </div>
      )}
      <ul className="sims-list">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <button type="button" className="sims-row" onClick={() => onEdit(r.id)}>
              <span className="sims-main">
                <strong>{r.title}</strong>
                <small>
                  {r.role} · {r.taskCount} task{r.taskCount === 1 ? '' : 's'} · about {r.estimatedHours}h
                </small>
              </span>
              <span className="sims-nums">
                <span>{r.enrolled} started</span>
                {r.waitingForReview > 0 && <span className="pill pill-hold">{r.waitingForReview} to read</span>}
                <span>{r.completed} completed</span>
              </span>
              <span className={`pill ${r.status === 'PUBLISHED' ? 'pill-pass' : 'pill-idle'}`}>{r.status.toLowerCase()}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                      */
/* -------------------------------------------------------------------------- */

const BLANK: SimulationInput = {
  title: '',
  role: '',
  summary: '',
  estimatedHours: 4,
  skills: [],
  tasks: [{ title: '', brief: '', resources: [] }],
};

function Editor({ id, onDone }: { id: string | null; onDone: () => void }) {
  const { can } = useAuth();
  const mayEdit = can('job:write');
  const [sim, setSim] = useState<CompanySimulation | null>(null);
  const [form, setForm] = useState<SimulationInput>(BLANK);
  const [skillText, setSkillText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    proofApi
      .companyGet(id)
      .then((s) => {
        setSim(s);
        setForm({
          title: s.title,
          role: s.role,
          summary: s.summary,
          estimatedHours: s.estimatedHours,
          skills: s.skills,
          tasks: s.tasks.map((t) => ({ title: t.title, brief: t.brief, resources: t.resources })),
        });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not open this simulation.'));
  }, [id]);

  const locked = (sim?._count.enrolments ?? 0) > 0;

  function setTask(i: number, patch: Partial<SimulationInput['tasks'][number]>) {
    setForm((f) => ({ ...f, tasks: f.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  }

  function move(i: number, by: -1 | 1) {
    setForm((f) => {
      const tasks = [...f.tasks];
      const j = i + by;
      if (j < 0 || j >= tasks.length) return f;
      [tasks[i], tasks[j]] = [tasks[j]!, tasks[i]!];
      return { ...f, tasks };
    });
  }

  function addSkills(text: string) {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setForm((f) => ({ ...f, skills: [...new Set([...f.skills, ...parts])] }));
    setSkillText('');
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = sim ? await proofApi.update(sim.id, form) : await proofApi.create(form);
      setSim(next);
      setSaved('Saved.');
      window.setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function status(s: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT') {
    if (!sim) return;
    setBusy(true);
    setError(null);
    try {
      setSim(await proofApi.setStatus(sim.id, s));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card sims-editor">
      <div className="sims-editor-head">
        <button type="button" className="linkish" onClick={onDone}>
          ← All simulations
        </button>
        {sim && <span className={`pill ${sim.status === 'PUBLISHED' ? 'pill-pass' : 'pill-idle'}`}>{sim.status.toLowerCase()}</span>}
      </div>

      {locked && (
        <p className="alert alert-warn">
          {sim!._count.enrolments} student{sim!._count.enrolments === 1 ? ' has' : 's have'} started this, so its tasks can no
          longer change. You can still edit the wording above and the resource links.
        </p>
      )}

      <div className="sims-grid">
        <label className="sims-field sims-wide">
          <span>Title</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Market-entry brief" disabled={!mayEdit} />
        </label>
        <label className="sims-field">
          <span>Role it is like</span>
          <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Business Analyst" disabled={!mayEdit} />
        </label>
        <label className="sims-field">
          <span>Hours it takes, roughly</span>
          <input
            type="number"
            min={1}
            max={40}
            value={form.estimatedHours}
            onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) || 1 })}
            disabled={!mayEdit}
          />
        </label>
        <label className="sims-field sims-wide">
          <span>What the student will do</span>
          <textarea
            rows={3}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Size a new market and recommend whether we should enter it."
            disabled={!mayEdit}
          />
        </label>
        <div className="sims-field sims-wide">
          <span>Skills it shows</span>
          <div className="sims-skills">
            {form.skills.map((s) => (
              <span key={s} className="chip">
                {s}
                {mayEdit && (
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => setForm({ ...form, skills: form.skills.filter((x) => x !== s) })}>
                    ×
                  </button>
                )}
              </span>
            ))}
            {mayEdit && (
              <input
                value={skillText}
                onChange={(e) => (e.target.value.includes(',') ? addSkills(e.target.value) : setSkillText(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkills(skillText);
                  }
                }}
                onBlur={() => addSkills(skillText)}
                placeholder={form.skills.length ? '' : 'Excel, market research…'}
              />
            )}
          </div>
          <small>These become employer-verified on the student’s passport when you mark the work complete.</small>
        </div>
      </div>

      <h2 className="sims-h">Tasks</h2>
      <ol className="sims-tasks">
        {form.tasks.map((t, i) => (
          <li key={i}>
            <div className="sims-task-head">
              <span className="sims-task-no">{i + 1}</span>
              <input
                value={t.title}
                onChange={(e) => setTask(i, { title: e.target.value })}
                placeholder="Size the market"
                disabled={!mayEdit || locked}
                aria-label={`Task ${i + 1} title`}
              />
              {mayEdit && !locked && (
                <span className="sims-task-tools">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === form.tasks.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, j) => j !== i) })}
                    disabled={form.tasks.length === 1}
                    aria-label="Remove task"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={t.brief}
              onChange={(e) => setTask(i, { brief: e.target.value })}
              placeholder="What to do, what a good answer includes, and the format you want it in."
              disabled={!mayEdit || locked}
            />
            <div className="sims-res">
              {t.resources.map((r, k) => (
                <div key={k} className="sims-res-row">
                  <input
                    value={r.label}
                    onChange={(e) => setTask(i, { resources: t.resources.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })}
                    placeholder="Label"
                    disabled={!mayEdit}
                  />
                  <input
                    value={r.url}
                    onChange={(e) => setTask(i, { resources: t.resources.map((x, m) => (m === k ? { ...x, url: e.target.value.trim() } : x)) })}
                    placeholder="https://"
                    disabled={!mayEdit}
                  />
                  {mayEdit && (
                    <button type="button" onClick={() => setTask(i, { resources: t.resources.filter((_, m) => m !== k) })} aria-label="Remove link">
                      ×
                    </button>
                  )}
                </div>
              ))}
              {mayEdit && (
                <button type="button" className="linkish" onClick={() => setTask(i, { resources: [...t.resources, { label: '', url: '' }] })}>
                  + Add a resource link
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {mayEdit && !locked && (
        <button type="button" className="sims-add" onClick={() => setForm({ ...form, tasks: [...form.tasks, { title: '', brief: '', resources: [] }] })}>
          + Add a task
        </button>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {mayEdit && (
        <div className="sims-actions">
          <span className="muted">{saved}</span>
          {sim?.status === 'PUBLISHED' && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => status('ARCHIVED')}>
              Archive
            </button>
          )}
          {sim && sim.status !== 'PUBLISHED' && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => status('PUBLISHED')}>
              Publish to students
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : sim ? 'Save changes' : 'Create draft'}
          </button>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Review                                                                      */
/* -------------------------------------------------------------------------- */

const QUEUE_FILTERS: { key: EnrolmentStatus | ''; label: string }[] = [
  { key: '', label: 'Waiting on you' },
  { key: 'NEEDS_WORK', label: 'Sent back' },
  { key: 'COMPLETED', label: 'Completed' },
];

function Queue({ onOpen }: { onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<EnrolmentStatus | ''>('');
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    proofApi
      .queue(filter || undefined)
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the queue.'));
  }, [filter]);

  return (
    <section>
      <div className="sims-bar">
        <div className="seg seg-sm" role="radiogroup" aria-label="Show">
          {QUEUE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              className={`seg-opt ${filter === f.key ? 'is-on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {rows && rows.length === 0 && <p className="muted sims-empty">Nothing here.</p>}
      <ul className="sims-list">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <button type="button" className="sims-row" onClick={() => onOpen(r.id)}>
              <span className="sims-main">
                <strong>{r.student.name}</strong>
                <small>
                  {r.simulation.title}
                  {r.student.college ? ` · ${r.student.college}` : ''}
                </small>
              </span>
              <span className="sims-nums">{r.explainAt && r.status === 'EXPLAIN_BOOKED' ? `Call ${when(r.explainAt)}` : ''}</span>
              <span className={`pill ${ENROL[r.status].pill}`}>{ENROL[r.status].label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Review({ id, onBack }: { id: string; onBack: () => void }) {
  const { can } = useAuth();
  const mayDecide = can('application:advance');
  const [e, setE] = useState<ReviewEnrolment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'NEEDS_WORK' | 'BOOK_EXPLAIN' | null>(null);
  const [note, setNote] = useState('');
  const [at, setAt] = useState('');

  const load = useCallback(() => {
    proofApi
      .review(id)
      .then(setE)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not open this work.'));
  }, [id]);

  useEffect(load, [load]);

  async function act(d: Parameters<typeof proofApi.decide>[1]) {
    setBusy(true);
    setError(null);
    try {
      setE(await proofApi.decide(id, d));
      setMode(null);
      setNote('');
      setAt('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (!e) return <p className="muted">{error ?? 'Loading…'}</p>;

  const reading = e.status === 'SUBMITTED' || e.status === 'EXPLAIN_BOOKED';

  return (
    <section className="card sims-review">
      <div className="sims-editor-head">
        <button type="button" className="linkish" onClick={onBack}>
          ← Review queue
        </button>
        <span className={`pill ${ENROL[e.status].pill}`}>{ENROL[e.status].label}</span>
      </div>
      <h2>
        {e.student.name}
        <small>
          {e.simulation.title}
          {e.student.college ? ` · ${e.student.college}` : ''}
        </small>
      </h2>

      <ol className="sims-answers">
        {e.tasks.map((t) => (
          <li key={t.id}>
            <h3>
              Task {t.order}: {t.title}
            </h3>
            {t.answer ? (
              <>
                {t.answer.text && <p className="sims-answer">{t.answer.text}</p>}
                {t.answer.link && (
                  <a href={t.answer.link} target="_blank" rel="noreferrer noopener">
                    {t.answer.link} ↗
                  </a>
                )}
              </>
            ) : (
              <p className="muted">Not answered.</p>
            )}
          </li>
        ))}
      </ol>

      {e.status === 'EXPLAIN_BOOKED' && (
        <p className="alert alert-warn">
          Explain-your-work call: <b>{e.explainAt ? when(e.explainAt) : 'time not set'}</b>.
          {e.explainNote && <span className="sims-note">{e.explainNote}</span>}
        </p>
      )}
      {e.status === 'COMPLETED' && (
        <p className="alert alert-ok">
          Completed. Certificate <b>{e.certificateCode}</b> is on the student’s passport.
        </p>
      )}

      {error && <p className="alert alert-error">{error}</p>}

      {mayDecide && reading && (
        <div className="sims-decide">
          <p className="sims-why">
            A certificate is never issued on the written work alone. Book a five-minute call and ask the student to walk you
            through their answers - that is what makes copied or AI-made work show.
          </p>

          {mode === null && (
            <div className="sims-decide-actions">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setMode('NEEDS_WORK')}>
                Send back
              </button>
              <button type="button" className={`btn ${e.status === 'SUBMITTED' ? 'btn-primary' : 'btn-secondary'}`} disabled={busy} onClick={() => setMode('BOOK_EXPLAIN')}>
                {e.status === 'EXPLAIN_BOOKED' ? 'Rebook the call' : 'Book the explain call'}
              </button>
              {e.status === 'EXPLAIN_BOOKED' && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act({ action: 'COMPLETE' })}>
                  The call went well - mark complete
                </button>
              )}
            </div>
          )}

          {mode === 'NEEDS_WORK' && (
            <div className="sims-form">
              <label className="sims-field">
                <span>What needs work? The student reads this.</span>
                <textarea rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} autoFocus />
              </label>
              <div className="sims-decide-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" disabled={busy || note.trim().length < 3} onClick={() => act({ action: 'NEEDS_WORK', note })}>
                  Send back
                </button>
              </div>
            </div>
          )}

          {mode === 'BOOK_EXPLAIN' && (
            <div className="sims-form">
              <label className="sims-field">
                <span>When</span>
                <input type="datetime-local" value={at} onChange={(ev) => setAt(ev.target.value)} />
              </label>
              <label className="sims-field">
                <span>Meeting link and what to prepare</span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  placeholder="Join at https://meet.demo.example/abc - be ready to walk through task 1."
                />
              </label>
              <div className="sims-decide-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !at || note.trim().length < 3}
                  onClick={() => act({ action: 'BOOK_EXPLAIN', explainAt: new Date(at).toISOString(), note })}
                >
                  Book the call
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
