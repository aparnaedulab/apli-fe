import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { LEVEL_LABEL, studentAppApi, type SimulationDetail } from '../../api/studentApp';
import { videoEmbed, type StudentPage } from '../../api/taskPages';
import Shell, { CompanyTile } from './Shell';
import { HandIn } from './Simulations';
import QuickCheck from './QuickCheck';
import { HandInHow } from './TestIntro';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** The parts of a task: the instructions (brief and reading, one page), each quick check, and the hand-in. */
type Step = { key: string; label: string; kind: 'intro' | 'check' | 'handin'; page?: StudentPage };

/**
 * Doing one task, a page at a time.
 *
 * On the left, every task in the simulation: done, the one in hand, and those
 * still locked behind it. In the middle, the task itself as a short sequence -
 * the brief, the pages the company wrote to read, the quick checks, and last
 * the hand-in - with a page counter above and Back / Next below.
 *
 * Quick checks are marked by the server; the right answers arrive only with
 * the marks. The hand-in opens once every check in the task is answered.
 */
export default function TaskPlayer() {
  const { slug = '', taskId = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SimulationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    studentAppApi
      .simulation(slug)
      .then(setData)
      .catch((e) => setError(message(e, 'Could not load this task.')));
  }, [slug]);

  useEffect(load, [load]);
  // A new task starts at its brief.
  useEffect(() => {
    setAt(0);
    setEditing(false);
    window.scrollTo({ top: 0 });
  }, [taskId]);

  async function act(key: string, call: () => Promise<SimulationDetail>): Promise<boolean> {
    setBusy(key);
    setError(null);
    setFieldErrors({});
    try {
      setData(await call());
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.fields?.length) setFieldErrors(Object.fromEntries(e.fields.map((f) => [f.path, f.message])));
      else setError(message(e, 'That did not work. Try again.'));
      return false;
    } finally {
      setBusy(null);
    }
  }

  const s = data?.simulation;
  const run = data?.run;
  const status = run?.status;
  const tasks = data?.tasks ?? [];
  const index = tasks.findIndex((t) => t.id === taskId);
  const task = index >= 0 ? tasks[index] : undefined;
  const next = tasks.find((t) => !t.done);
  const canWork = status === 'ACTIVE' || status === 'NEEDS_WORK';

  /** A task can be opened once it is done, it is the next one, or changes were asked. */
  const reachable = (i: number) => {
    const t = tasks[i]!;
    if (!run) return false;
    if (t.done || status === 'NEEDS_WORK' || status === 'IN_REVIEW' || status === 'COMPLETED') return true;
    return next?.id === t.id;
  };

  const steps: Step[] = useMemo(() => {
    if (!task) return [];
    // Everything to read sits together under Instructions, so only the
    // test itself is counted - question by question, inside each check.
    return [
      { key: 'intro', label: 'Instructions', kind: 'intro' },
      ...task.pages.filter((p) => p.kind === 'check').map((p) => ({ key: p.id, label: p.title, kind: 'check', page: p }) as Step),
      { key: 'handin', label: 'Hand in', kind: 'handin' },
    ];
  }, [task]);

  const unanswered = task ? task.pages.filter((p) => p.kind === 'check' && !task.checks[p.id]) : [];
  const step = steps[at];

  // Not started, or a task out of reach: back to the simulation's page.
  if (data && (!task || !reachable(index))) {
    return (
      <Shell>
        <div className="sa-wrap sa-body">
          <p className="sa-empty">
            {!run ? 'Start the simulation first.' : 'Finish the tasks before this one first.'}{' '}
            <Link to={`/student/simulations/${slug}#tasks`} className="sa-link">
              Back to the tasks
            </Link>
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={`tp ${step?.kind === 'check' ? 'is-testing' : ''}`}>
        {/* Every task, and where the student is. */}
        <aside className="tp-rail">
          {s && (
            <Link to={`/student/simulations/${slug}`} className="tp-sim">
              <CompanyTile company={s.company} />
              <span>
                <b>{s.title}</b>
                <span>{s.company.name}</span>
              </span>
            </Link>
          )}
          {data && (
            <p className="tp-progress">
              {tasks.filter((t) => t.done).length} of {tasks.length} tasks handed in
            </p>
          )}
          <ol className="tp-tasks">
            {tasks.map((t, i) => {
              const open = reachable(i);
              const here = t.id === taskId;
              const inner = (
                <>
                  <span className="tp-n" aria-hidden="true">
                    {t.done ? '✓' : open ? i + 1 : '🔒'}
                  </span>
                  <span className="tp-task-text">
                    <b>{t.title}</b>
                    <span className="tp-task-desc">{t.brief}</span>
                    <span className="tp-task-meta">
                      {s ? LEVEL_LABEL[s.level] : ''} · ~{t.minutes} min
                    </span>
                  </span>
                </>
              );
              return (
                <li key={t.id} className={`${here ? 'is-here' : ''} ${t.done ? 'is-done' : ''} ${open ? '' : 'is-locked'}`}>
                  {open && !here ? (
                    <Link to={`/student/simulations/${slug}/tasks/${t.id}`}>{inner}</Link>
                  ) : (
                    <div aria-current={here ? 'step' : undefined}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="tp-main">
          {error && <p className="sa-alert">{error}</p>}
          {!data && !error && <p className="sa-loading">Loading…</p>}
          {/* The test: the onboarding, then only the questions. */}
          {task && step?.kind === 'check' && step.page?.kind === 'check' && (
            <div className="tp-test">
              <div className="tp-testbar">
                <button type="button" className="sa-quiet" onClick={() => setAt(0)}>
                  <span aria-hidden="true">←</span> Back to the task
                </button>
                <span>
                  {task.title} · {step.label}
                </span>
              </div>
              <QuickCheck
                key={step.page.id}
                page={step.page}
                marked={task.checks[step.page.id]}
                canAnswer={canWork}
                busy={busy === step.page.id}
                onSubmit={(answers) => act(step.page!.id, () => studentAppApi.answerCheck(slug, task.id, step.page!.id, answers))}
              />
              {task.checks[step.page.id] && steps[at + 1] && (
                <div className="tp-test-next">
                  <button type="button" className="sa-btn" onClick={() => setAt(at + 1)}>
                    {steps[at + 1]!.kind === 'handin' ? 'Done - go to the hand-in' : `Next test: ${steps[at + 1]!.label}`}{' '}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {task && step && step.kind !== 'check' && (
            <>
              <header className="tp-head">
                <div>
                  <p className="sa-eyebrow">
                    Task {index + 1} of {tasks.length}
                  </p>
                  <h1>{task.title}</h1>
                </div>
              </header>

              {/* The parts of the task, by name: no numbers here to mix up with the questions. */}
              <nav className="tp-parts" aria-label="Parts of this task">
                {steps.map((st, i) => {
                  const done =
                    (st.kind === 'intro' && at > 0) ||
                    (st.kind === 'check' && Boolean(task.checks[st.key])) ||
                    (st.kind === 'handin' && task.done);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      className={`${i === at ? 'is-on' : ''} ${done ? 'is-done' : ''}`}
                      onClick={() => setAt(i)}
                      aria-current={i === at ? 'step' : undefined}
                    >
                      <span className="tp-part-mark" aria-hidden="true">
                        {done ? '✓' : st.kind === 'intro' ? '≡' : st.kind === 'check' ? '?' : '↑'}
                      </span>
                      {st.kind === 'check' && st.label === 'Quick check' && steps.filter((x) => x.kind === 'check').length > 1
                        ? `Quick check ${steps.filter((x, j) => x.kind === 'check' && j <= i).length}`
                        : st.label}
                    </button>
                  );
                })}
              </nav>

              {step.kind === 'intro' && (
                <section className="tp-page">
                  <h2 className="tp-intro-title">Before you start</h2>
                  <p className="tp-lead">{task.brief}</p>
                  {task.learn.length > 0 && (
                    <div className="sa-pt-learn">
                      <h4>What you will learn</h4>
                      <ul>
                        {task.learn.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {task.steps.length > 0 && (
                    <div className="sa-pt-steps">
                      <h4>What you will do</h4>
                      <ol>
                        {task.steps.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {task.handIn && (
                    <p className="sa-task-handin">
                      <b>You will hand in:</b> {task.handIn}
                    </p>
                  )}
                  {task.pages
                    .filter((p): p is Extract<StudentPage, { kind: 'read' }> => p.kind === 'read')
                    .map((p) => (
                      <ReadPage key={p.id} page={p} />
                    ))}

                  {steps.some((x) => x.kind === 'check') && (
                    <div className="tp-tests">
                      <h3>{steps.filter((x) => x.kind === 'check').length === 1 ? 'The test' : 'The tests'}</h3>
                      <p className="sd-muted">
                        When you have read everything above, take the test. It opens on its own screen with a short how-to
                        first.
                      </p>
                      {steps.map((x, i) => {
                        if (x.kind !== 'check' || x.page?.kind !== 'check') return null;
                        const result = task.checks[x.key];
                        const n = x.page.questions.length;
                        return (
                          <div key={x.key} className={`tp-test-card ${result ? 'is-done' : ''}`}>
                            <div>
                              <b>{x.label}</b>
                              <span>
                                {n} question{n === 1 ? '' : 's'} · about {Math.max(2, Math.round(n * 1.5))} min
                                {result ? ` · ${result.score} of ${result.total} right` : ''}
                              </span>
                            </div>
                            <button type="button" className={`sa-btn ${result ? 'is-ghost' : ''}`} onClick={() => setAt(i)}>
                              {result ? 'See your answers' : 'Start the test'} <span aria-hidden="true">→</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {step.kind === 'handin' && (
                <section className="tp-page">
                  {/* The question comes first: what they are answering, then how to hand it in. */}
                  <div className="tp-ask">
                    <p className="sa-eyebrow">Your task</p>
                    <h2>{task.title}</h2>
                    <p className="tp-ask-brief">{task.brief}</p>
                    {task.steps.length > 0 && (
                      <div className="sa-pt-steps">
                        <h4>What to do</h4>
                        <ol>
                          {task.steps.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <p className="tp-ask-handin">
                      <b>Hand in:</b>{' '}
                      {task.handIn ??
                        `your answer to the task above - ${task.handInKinds
                          .map((k) => ({ text: 'written out', link: 'as a link', file: 'as a file' })[k])
                          .join(', or ')}.`}
                      <span> · about {task.minutes} min</span>
                    </p>
                    <button type="button" className="sa-quiet" onClick={() => setAt(0)}>
                      Read the full instructions again
                    </button>
                  </div>
                  {canWork && !task.done && <HandInHow kinds={task.handInKinds} />}
                  {unanswered.length > 0 && canWork ? (
                    <div className="tp-blocked">
                      <b>Answer the quick check{unanswered.length === 1 ? '' : 's'} first.</b>
                      {unanswered.map((p) => (
                        <button key={p.id} type="button" className="sa-link" onClick={() => setAt(steps.findIndex((x) => x.key === p.id))}>
                          {p.title} →
                        </button>
                      ))}
                    </div>
                  ) : canWork && (!task.done || editing || status === 'NEEDS_WORK') ? (
                    <HandIn
                      key={task.id}
                      kinds={task.handInKinds}
                      initial={task.handedIn}
                      busy={busy === 'handin'}
                      errors={fieldErrors}
                      onCancel={editing ? () => setEditing(false) : undefined}
                      onSubmit={async (body) => {
                        if (await act('handin', () => studentAppApi.handIn(slug, task.id, body))) setEditing(false);
                      }}
                    />
                  ) : task.handedIn ? (
                    <div className="sa-handed">
                      <span className="sa-handed-label">You handed in</span>
                      {task.handedIn.answer && <p>{task.handedIn.answer}</p>}
                      {task.handedIn.link && (
                        <a href={task.handedIn.link} target="_blank" rel="noreferrer" className="sa-link is-small">
                          {task.handedIn.link} ↗
                        </a>
                      )}
                      {task.handedIn.fileUrl && (
                        <a href={task.handedIn.fileUrl} target="_blank" rel="noreferrer" className="sa-link is-small">
                          File: {task.handedIn.fileName ?? 'attached'} ↗
                        </a>
                      )}
                    </div>
                  ) : null}

                  {task.done && (
                    <div className="tp-after">
                      {tasks[index + 1] ? (
                        <Link to={`/student/simulations/${slug}/tasks/${tasks[index + 1]!.id}`} className="sa-btn">
                          Next task: {tasks[index + 1]!.title} <span aria-hidden="true">→</span>
                        </Link>
                      ) : tasks.every((t) => t.done) && canWork ? (
                        <Link to={`/student/simulations/${slug}#tasks`} className="sa-btn">
                          All tasks in - explain your work <span aria-hidden="true">→</span>
                        </Link>
                      ) : null}
                    </div>
                  )}
                </section>
              )}

              <footer className="tp-foot">
                <button
                  type="button"
                  className="sa-quiet"
                  onClick={() => (at === 0 ? navigate(`/student/simulations/${slug}#tasks`) : setAt(at - 1))}
                >
                  <span aria-hidden="true">←</span> {at === 0 ? 'All tasks' : 'Back'}
                </button>
                {step.kind === 'intro' && (
                  <button type="button" className="sa-btn" onClick={() => setAt(at + 1)}>
                    {steps[at + 1]?.kind === 'check' ? 'Start the test' : 'Go to the hand-in'} <span aria-hidden="true">→</span>
                  </button>
                )}
              </footer>
            </>
          )}
        </main>
      </div>
    </Shell>
  );
}

function ReadPage({ page }: { page: Extract<StudentPage, { kind: 'read' }> }) {
  const embed = videoEmbed(page.videoUrl);
  return (
    <section className="tp-read">
      <h3>{page.title}</h3>
      {embed && (
        <div className="sa-video">
          <iframe
            src={embed}
            title={page.title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
      <div className="tp-prose">
        {page.body.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}
