import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import {
  certificateLink,
  proofApi,
  type EnrolmentStatus,
  type StudentSimulation,
  type StudentSimulationRow,
} from '../../api/proof';
import { useAuth } from '../../auth/AuthContext';
import './Projects.css';

const STATUS: Record<EnrolmentStatus, { label: string; pill: string }> = {
  IN_PROGRESS: { label: 'In progress', pill: 'pill-idle' },
  SUBMITTED: { label: 'With the company', pill: 'pill-hold' },
  EXPLAIN_BOOKED: { label: 'Explain call booked', pill: 'pill-hold' },
  NEEDS_WORK: { label: 'Needs work', pill: 'pill-stop' },
  COMPLETED: { label: 'Completed', pill: 'pill-pass' },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * /student/projects - work simulations: short projects built by companies.
 *
 * One page, two views: the list, and a simulation open for work (?id=). The
 * student works task by task, submits when every task is answered, and then
 * explains their work on a short call - after which the company can issue a
 * certificate anyone can check.
 */
export default function Projects() {
  const { hasModule } = useAuth();
  const enabled = hasModule('proof.simulations');
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');
  const navigate = useNavigate();

  // A simulation opened by id may be a job's hiring round, which the student
  // must be able to do whether or not the catalogue is switched on - the
  // server decides access. Without the catalogue, "back" means the application.
  return (
    <StudentLayout>
      {openId ? (
        <Workspace
          id={openId}
          onBack={() => (enabled ? setParams({}, { replace: false }) : navigate('/student/applications'))}
        />
      ) : !enabled ? (
        <>
          <Head />
          <p className="alert">Work simulations are not switched on for your institution.</p>
        </>
      ) : (
        <List onOpen={(id) => setParams({ id })} />
      )}
    </StudentLayout>
  );
}

function Head() {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">Projects</p>
        <h1>Real work, from real companies.</h1>
        <p className="page-lede">
          Short projects companies built to show what a role is actually like. Finish one and the company reviews your
          work - it becomes a certificate on your skills passport.
        </p>
      </div>
    </header>
  );
}

function List({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<StudentSimulationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    proofApi
      .list()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load projects.'));
  }, []);

  const mine = (rows ?? []).filter((r) => r.mine);
  const open = (rows ?? []).filter((r) => !r.mine);

  return (
    <>
      <Head />
      {error && <p className="alert alert-error">{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && (
        <div className="empty">
          <h2>No projects yet.</h2>
          <p>When companies publish work simulations, they appear here.</p>
        </div>
      )}
      {mine.length > 0 && (
        <section className="sim-section">
          <h2>Yours</h2>
          <ul className="sim-grid">
            {mine.map((r) => (
              <SimCard key={r.id} row={r} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      )}
      {open.length > 0 && (
        <section className="sim-section">
          <h2>{mine.length > 0 ? 'More to try' : 'Pick one to start'}</h2>
          <ul className="sim-grid">
            {open.map((r) => (
              <SimCard key={r.id} row={r} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SimCard({ row, onOpen }: { row: StudentSimulationRow; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" className="sim-card" onClick={() => onOpen(row.id)}>
        <span className="sim-company">{row.company.name}</span>
        <strong>{row.title}</strong>
        <span className="sim-role">{row.role}</span>
        <span className="sim-meta">
          About {row.estimatedHours} hour{row.estimatedHours === 1 ? '' : 's'} · {row.taskCount} task
          {row.taskCount === 1 ? '' : 's'}
        </span>
        {row.skills.length > 0 && (
          <span className="sim-skills">
            {row.skills.slice(0, 4).map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </span>
        )}
        {row.mine && <span className={`pill ${STATUS[row.mine.status].pill}`}>{STATUS[row.mine.status].label}</span>}
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* One simulation, open for work                                               */
/* -------------------------------------------------------------------------- */

function Workspace({ id, onBack }: { id: string; onBack: () => void }) {
  const [sim, setSim] = useState<StudentSimulation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);

  const load = useCallback(() => {
    proofApi
      .get(id)
      .then(setSim)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not open this project.'));
  }, [id]);

  useEffect(load, [load]);

  async function run(fn: () => Promise<StudentSimulation>) {
    setBusy(true);
    setError(null);
    try {
      setSim(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (!sim) {
    return (
      <>
        <p className="sim-back">
          <button type="button" className="linkish" onClick={onBack}>
            ← All projects
          </button>
        </p>
        {error ? <p className="alert alert-error">{error}</p> : <p className="muted">Loading…</p>}
      </>
    );
  }

  const e = sim.enrolment;
  const editable = !e || e.status === 'IN_PROGRESS' || e.status === 'NEEDS_WORK';
  const answered = sim.tasks.filter((t) => t.answer && (t.answer.text || t.answer.link)).length;
  const task = sim.tasks[Math.min(active, sim.tasks.length - 1)];

  return (
    <>
      <p className="sim-back">
        <button type="button" className="linkish" onClick={onBack}>
          ← All projects
        </button>
      </p>
      <header className="page-head">
        <div>
          <p className="eyebrow">{sim.company.name}</p>
          <h1>{sim.title}</h1>
          <p className="page-lede">
            {sim.role} · about {sim.estimatedHours} hour{sim.estimatedHours === 1 ? '' : 's'}
          </p>
        </div>
        {!e && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => proofApi.enrol(sim.id))}>
            Start this project
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {e && <StatusBanner sim={sim} />}

      <section className="card">
        <h2>What you will do</h2>
        <p className="sim-summary">{sim.summary}</p>
        {sim.skills.length > 0 && (
          <p className="sim-skills">
            {sim.skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </p>
        )}
      </section>

      {e && task && (
        <section className="card sim-work">
          <ol className="sim-steps" aria-label="Tasks">
            {sim.tasks.map((t, i) => {
              const done = Boolean(t.answer && (t.answer.text || t.answer.link));
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`${i === active ? 'is-on' : ''} ${done ? 'is-done' : ''}`}
                    onClick={() => setActive(i)}
                    aria-current={i === active ? 'step' : undefined}
                  >
                    <span aria-hidden="true">{done ? '✓' : t.order}</span>
                    {t.title}
                  </button>
                </li>
              );
            })}
          </ol>

          <TaskPanel
            key={task.id}
            task={task}
            editable={editable}
            busy={busy}
            onSave={(text, link) =>
              run(async () => {
                const next = await proofApi.answer(sim.id, task.id, { text, link });
                if (active < sim.tasks.length - 1) setActive(active + 1);
                return next;
              })
            }
          />

          {editable && (
            <div className="sim-submit">
              <span className="muted">
                {answered} of {sim.tasks.length} tasks answered
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || answered < sim.tasks.length}
                onClick={() => run(() => proofApi.submit(sim.id))}
                title={answered < sim.tasks.length ? 'Answer every task first' : undefined}
              >
                {e.status === 'NEEDS_WORK' ? 'Send it back' : 'Submit my work'}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function StatusBanner({ sim }: { sim: StudentSimulation }) {
  const e = sim.enrolment!;
  const [copied, setCopied] = useState(false);

  if (e.status === 'IN_PROGRESS') return null;

  if (e.status === 'COMPLETED' && e.certificateCode) {
    const link = certificateLink(e.certificateCode);
    return (
      <section className="sim-cert">
        <p className="eyebrow">Certificate</p>
        <h2>You completed it.</h2>
        <p>
          {sim.company.name} reviewed your work and heard you explain it. It is now on your skills passport as
          employer-verified.
        </p>
        <p className="sim-code">
          Certificate code <strong>{e.certificateCode}</strong>
        </p>
        <div className="sim-cert-actions">
          <a className="btn btn-primary" href={link} target="_blank" rel="noreferrer">
            Open the public check
          </a>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              void navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              })
            }
          >
            {copied ? 'Copied ✓' : 'Copy link to share'}
          </button>
        </div>
      </section>
    );
  }

  const tone = e.status === 'NEEDS_WORK' ? 'alert-error' : 'alert-warn';
  return (
    <div className={`alert ${tone} sim-status`}>
      <b>{STATUS[e.status].label}.</b>{' '}
      {e.status === 'SUBMITTED' && `${sim.company.name} is reading your work. Next comes a short call where you explain it.`}
      {e.status === 'EXPLAIN_BOOKED' && (
        <>
          Your explain-your-work call is on <b>{e.explainAt ? when(e.explainAt) : 'a date to be confirmed'}</b>. About five
          minutes: be ready to walk through what you did and why.
        </>
      )}
      {e.status === 'NEEDS_WORK' && 'Improve your answers below and send it back.'}
      {e.explainNote && <span className="sim-note">{e.explainNote}</span>}
    </div>
  );
}

function TaskPanel({
  task,
  editable,
  busy,
  onSave,
}: {
  task: StudentSimulation['tasks'][number];
  editable: boolean;
  busy: boolean;
  onSave: (text: string, link: string) => void;
}) {
  const [text, setText] = useState(task.answer?.text ?? '');
  const [link, setLink] = useState(task.answer?.link ?? '');
  const changed = text !== (task.answer?.text ?? '') || link !== (task.answer?.link ?? '');

  return (
    <div className="sim-task">
      <h3>
        Task {task.order}: {task.title}
      </h3>
      <p className="sim-brief">{task.brief}</p>
      {task.resources.length > 0 && (
        <ul className="sim-resources">
          {task.resources.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noreferrer noopener">
                {r.label} ↗
              </a>
            </li>
          ))}
        </ul>
      )}

      <label className="sim-field">
        <span>Your answer</span>
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!editable}
          placeholder="Write it here - your working matters as much as the answer."
        />
      </label>
      <label className="sim-field">
        <span>
          Link <small>optional - a sheet, a document, a repository</small>
        </span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value.trim())}
          disabled={!editable}
          placeholder="https://"
        />
      </label>
      {editable && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !changed || (!text.trim() && !link)}
          onClick={() => onSave(text, link)}
        >
          Save this task
        </button>
      )}
    </div>
  );
}
