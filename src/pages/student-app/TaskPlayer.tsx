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

/* Small helpers for what this browser remembers: a task's ticked steps, its
   notes, when it was first opened, and whether focus mode is on. A browser
   that refuses storage simply forgets. */
function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not worth failing over.
  }
}
function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Not worth failing over.
  }
}

/** True while the person is typing in a field, so single-key shortcuts stay out of the way. */
function typing() {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/**
 * Doing one task, across the whole screen.
 *
 * Left: every task in the simulation - done, the one in hand, and those still
 * locked. Centre: the task as a short sequence (the brief and reading, the
 * quick checks, the hand-in) with the parts named across the top and Back /
 * Next pinned to the bottom. Right: a work panel that stays in view - time on
 * the task against the suggested time, the steps to tick off, private notes
 * and what to hand in.
 *
 * Focus mode (F) folds both side panels away; [ and ] move between the parts.
 * Notes, ticked steps and an unsent answer are kept in this browser.
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
  const [focus, setFocus] = useState(() => readLocal('tp.focus', false));

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

  useEffect(() => writeLocal('tp.focus', focus), [focus]);

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
  const doneCount = tasks.filter((t) => t.done).length;

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
  const testing = step?.kind === 'check';
  const draftKey = `tp.draft.${slug}.${taskId}`;

  // The test to point at from the top of the page: the first one not yet
  // answered, or the first one to look back at once all are done.
  const checkSteps = steps.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'check');
  const nextCheck = checkSteps.find(({ x }) => !task?.checks[x.key]) ?? null;
  const testTarget = nextCheck ?? checkSteps[0] ?? null;
  const testsLeft = checkSteps.filter(({ x }) => !task?.checks[x.key]).length;
  const testQuestions =
    testTarget?.x.page?.kind === 'check' ? testTarget.x.page.questions.length : 0;

  // Keyboard: [ and ] move between the parts, F folds the side panels away.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ']' && at < steps.length - 1) {
        e.preventDefault();
        setAt((a) => a + 1);
      } else if (e.key === '[' && at > 0) {
        e.preventDefault();
        setAt((a) => a - 1);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFocus((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, steps.length]);

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

  const partDone = (st: Step) =>
    Boolean(task) &&
    ((st.kind === 'intro' && at > 0) || (st.kind === 'check' && Boolean(task!.checks[st.key])) || (st.kind === 'handin' && task!.done));

  return (
    <Shell>
      <div className={`tp is-wide ${testing ? 'is-testing' : ''} ${focus ? 'is-focus' : ''}`}>
        {/* Where the student is in the whole simulation, always in view. */}
        <div className="tp-topbar">
          <Link to={`/student/simulations/${slug}`} className="tp-top-back" aria-label="Back to the simulation">
            <span aria-hidden="true">←</span>
          </Link>
          {s && (
            <span className="tp-top-sim">
              <CompanyTile company={s.company} />
              <span>
                <b>{s.title}</b>
                <i>{s.company.name}</i>
              </span>
            </span>
          )}
          {tasks.length > 0 && (
            <div className="tp-top-progress" aria-label={`${doneCount} of ${tasks.length} tasks handed in`}>
              <div className="tp-segs">
                {tasks.map((t, i) => (
                  <span
                    key={t.id}
                    className={`${t.done ? 'is-done' : ''} ${t.id === taskId ? 'is-here' : ''}`}
                    title={`Task ${i + 1}: ${t.title}${t.done ? ' - handed in' : ''}`}
                  />
                ))}
              </div>
              <span className="tp-top-count">
                {doneCount} of {tasks.length} tasks handed in
              </span>
            </div>
          )}
          <button
            type="button"
            className={`tp-focus-btn ${focus ? 'is-on' : ''}`}
            onClick={() => setFocus((v) => !v)}
            aria-pressed={focus}
            title="Focus mode (F)"
          >
            {focus ? 'Exit focus' : 'Focus mode'}
          </button>
        </div>

        {/* Every task, and where the student is. */}
        <aside className="tp-rail">
          <p className="tp-rail-title">Tasks</p>
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
          {!data && !error && <TaskSkeleton />}

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
                <TaskClock taskId={task.id} minutes={task.minutes} compact />
              </div>
              <QuickCheck
                key={step.page.id}
                page={step.page}
                marked={task.checks[step.page.id]}
                company={data?.company.name ?? 'the company'}
                // A test can be taken again any time, except while the work is with a reviewer.
                canAnswer={Boolean(run) && status !== 'IN_REVIEW'}
                busy={busy === step.page.id}
                onSubmit={(answers) => act(step.page!.id, () => studentAppApi.answerCheck(slug, task.id, step.page!.id, answers))}
                onReveal={() => act(step.page!.id, () => studentAppApi.revealCheck(slug, task.id, step.page!.id))}
                onSend={(attempt) => act(step.page!.id, () => studentAppApi.sendCheck(slug, task.id, step.page!.id, attempt))}
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
                    Task {index + 1} of {tasks.length} · about {task.minutes} min
                  </p>
                  <h1>{task.title}</h1>
                </div>
                <div className="tp-head-actions">
                  {task.done && <span className="tp-done-chip">✓ Handed in</span>}
                  {/* The test, reachable without scrolling past the reading. */}
                  {step.kind === 'intro' && testTarget && (
                    <button
                      type="button"
                      className={`sa-btn ${nextCheck ? '' : 'is-ghost'}`}
                      onClick={() => setAt(testTarget.i)}
                    >
                      {nextCheck
                        ? `Start the test${checkSteps.length > 1 ? ` (${testsLeft} left)` : ''}`
                        : 'See your test answers'}{' '}
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                  {step.kind === 'intro' && !testTarget && !task.done && (
                    <button type="button" className="sa-btn" onClick={() => setAt(steps.length - 1)}>
                      Go to the hand-in <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </header>

              {/* The parts of the task, by name, with a line showing how far through it they are. */}
              <nav className="tp-parts" aria-label="Parts of this task">
                {steps.map((st, i) => (
                  <button
                    key={st.key}
                    type="button"
                    className={`${i === at ? 'is-on' : ''} ${partDone(st) ? 'is-done' : ''}`}
                    onClick={() => setAt(i)}
                    aria-current={i === at ? 'step' : undefined}
                  >
                    <span className="tp-part-mark" aria-hidden="true">
                      {partDone(st) ? '✓' : st.kind === 'intro' ? '≡' : st.kind === 'check' ? '?' : '↑'}
                    </span>
                    {st.kind === 'check' && st.label === 'Quick check' && steps.filter((x) => x.kind === 'check').length > 1
                      ? `Quick check ${steps.filter((x, j) => x.kind === 'check' && j <= i).length}`
                      : st.label}
                  </button>
                ))}
              </nav>

              {step.kind === 'intro' && (
                <section className="tp-page">
                  <div className="tp-brief-card">
                    <h2 className="tp-intro-title">Before you start</h2>
                    <p className="tp-lead">{task.brief}</p>
                  </div>
                  <div className="tp-two">
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
                  </div>
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
                      draftKey={draftKey}
                      onCancel={editing ? () => setEditing(false) : undefined}
                      onSubmit={async (body) => {
                        if (await act('handin', () => studentAppApi.handIn(slug, task.id, body))) {
                          removeLocal(draftKey);
                          setEditing(false);
                        }
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
                      {canWork && (
                        <button type="button" className="sa-quiet" onClick={() => setEditing(true)}>
                          Change what you handed in
                        </button>
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

              {/* Back and Next, pinned to the bottom of the screen. */}
              <footer className="tp-foot">
                <button
                  type="button"
                  className="sa-quiet"
                  onClick={() => (at === 0 ? navigate(`/student/simulations/${slug}#tasks`) : setAt(at - 1))}
                >
                  <span aria-hidden="true">←</span> {at === 0 ? 'All tasks' : 'Back'}
                </button>
                <span className="tp-foot-where">
                  {step.label} · part {at + 1} of {steps.length}
                </span>
                {step.kind === 'intro' && (
                  <button type="button" className="sa-btn" onClick={() => setAt(at + 1)}>
                    {steps[at + 1]?.kind === 'check' ? 'Start the test' : 'Go to the hand-in'} <span aria-hidden="true">→</span>
                  </button>
                )}
              </footer>
            </>
          )}
        </main>

        {/* The work panel: stays in view beside the task. */}
        {task && !testing && (
          <aside className="tp-panel" aria-label="Your work on this task">
            {testTarget && (
              <div className={`tp-card tp-test-cta ${nextCheck ? '' : 'is-done'}`}>
                <h3>
                  {checkSteps.length === 1 ? 'Quick check' : 'Quick checks'}
                  <span className="tp-card-count">
                    {checkSteps.length - testsLeft}/{checkSteps.length} done
                  </span>
                </h3>
                <p className="tp-card-text">
                  {nextCheck
                    ? `${testQuestions} question${testQuestions === 1 ? '' : 's'} · about ${Math.max(2, Math.round(testQuestions * 1.5))} min. Answer ${checkSteps.length === 1 ? 'it' : 'them'} before the hand-in.`
                    : 'All answered. You can look back at your answers any time.'}
                </p>
                <button
                  type="button"
                  className={`sa-btn is-small is-wide ${nextCheck ? '' : 'is-ghost'}`}
                  onClick={() => setAt(testTarget.i)}
                >
                  {nextCheck ? 'Start the test' : 'See your answers'} <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
            <TaskClock taskId={task.id} minutes={task.minutes} />
            {task.steps.length > 0 && <StepChecklist taskId={task.id} steps={task.steps} />}
            <TaskNotes taskId={task.id} />
            <div className="tp-card">
              <h3>To hand in</h3>
              <p className="tp-card-text">
                {task.handIn ?? 'Your answer to the task - written out, as a link or as a file.'}
              </p>
              <p className={`tp-handin-state ${task.done ? 'is-done' : ''}`}>
                {task.done ? '✓ Handed in' : unanswered.length ? `Answer ${unanswered.length} quick check${unanswered.length === 1 ? '' : 's'} first` : 'Not handed in yet'}
              </p>
              {!task.done && step?.kind !== 'handin' && (
                <button type="button" className="sa-btn is-small is-wide" onClick={() => setAt(steps.length - 1)}>
                  Go to the hand-in <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
            <div className="tp-card tp-keys">
              <h3>Shortcuts</h3>
              <p>
                <kbd>[</kbd> <kbd>]</kbd> previous / next part
              </p>
              <p>
                <kbd>F</kbd> focus mode
              </p>
            </div>
          </aside>
        )}
      </div>
    </Shell>
  );
}

/**
 * Time on this task since it was first opened in this browser, against the
 * suggested time. A guide, not a limit: nothing happens when it runs over.
 */
function TaskClock({ taskId, minutes, compact }: { taskId: string; minutes: number; compact?: boolean }) {
  const key = `tp.since.${taskId}`;
  const [since] = useState<number>(() => {
    const saved = readLocal<number | null>(key, null);
    if (saved) return saved;
    const now = Date.now();
    writeLocal(key, now);
    return now;
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const spent = Math.max(0, Math.round((now - since) / 60_000));
  const pct = Math.min(100, Math.round((spent / Math.max(1, minutes)) * 100));
  const over = spent > minutes;
  const label = spent < 60 ? `${spent} min` : `${Math.floor(spent / 60)} h ${spent % 60} min`;

  if (compact) {
    return (
      <span className={`tp-clock-chip ${over ? 'is-over' : ''}`} title="Time on this task, against the suggested time">
        ⏱ {label} / ~{minutes} min
      </span>
    );
  }
  return (
    <div className="tp-card">
      <h3>Time on this task</h3>
      <p className="tp-clock">
        <b>{label}</b> <span>of about {minutes} min</span>
      </p>
      <div className={`tp-bar ${over ? 'is-over' : ''}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="tp-card-hint">{over ? 'Taking longer is fine - there is no deadline.' : 'A guide, not a timer. Work at your own pace.'}</p>
    </div>
  );
}

/** The task's steps, to tick off as they go. Kept in this browser. */
function StepChecklist({ taskId, steps }: { taskId: string; steps: string[] }) {
  const key = `tp.steps.${taskId}`;
  const [ticked, setTicked] = useState<number[]>(() => readLocal<number[]>(key, []));
  useEffect(() => writeLocal(key, ticked), [key, ticked]);
  const done = ticked.filter((i) => i < steps.length).length;

  return (
    <div className="tp-card">
      <h3>
        Steps <span className="tp-card-count">{done}/{steps.length}</span>
      </h3>
      <div className="tp-bar">
        <span style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
      </div>
      <ul className="tp-checklist">
        {steps.map((st, i) => {
          const on = ticked.includes(i);
          return (
            <li key={st}>
              <label className={on ? 'is-on' : ''}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setTicked((list) => (on ? list.filter((x) => x !== i) : [...list, i]))}
                />
                <span>{st}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Private notes for the task, saved as they are typed. Only this student, in this browser, sees them. */
function TaskNotes({ taskId }: { taskId: string }) {
  const key = `tp.notes.${taskId}`;
  const [text, setText] = useState(() => readLocal(key, ''));
  const [saved, setSaved] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSaved(false);
    const t = window.setTimeout(() => {
      writeLocal(key, text);
      setSaved(true);
    }, 500);
    return () => window.clearTimeout(t);
  }, [key, text]);

  return (
    <div className="tp-card">
      <h3>
        My notes <span className="tp-card-count">{text.trim() ? (saved ? 'Saved' : 'Saving…') : 'Private'}</span>
      </h3>
      <textarea
        className="tp-notes"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Jot down findings, numbers and ideas as you work. Only you see these."
      />
      {text.trim() && (
        <button
          type="button"
          className="sa-quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              // Clipboard refused; the notes are still there to select.
            }
          }}
        >
          {copied ? '✓ Copied' : 'Copy notes'}
        </button>
      )}
    </div>
  );
}

/** A quiet outline of the page while the task loads. */
function TaskSkeleton() {
  return (
    <div className="tp-skeleton" aria-hidden="true">
      <span className="sa-skel" style={{ width: '30%', height: 14 }} />
      <span className="sa-skel" style={{ width: '60%', height: 28 }} />
      <span className="sa-skel" style={{ width: '100%', height: 44 }} />
      <span className="sa-skel" style={{ width: '100%', height: 180 }} />
    </div>
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
