import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { companyAppApi, STATUS_LABEL, type RunStatus, type SimAnalytics } from '../../api/companyApp';
import Frame from './Frame';
import { AnswerList } from './Work';
import { OfferButton } from './Offers';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const percent = (v: number | null) => (v === null ? '—' : `${v}%`);

const RUN: Record<RunStatus, { label: string; tone: string }> = {
  ACTIVE: { label: 'Working', tone: 'is-working' },
  IN_REVIEW: { label: 'To review', tone: 'is-review' },
  NEEDS_WORK: { label: 'Changes asked', tone: 'is-changes' },
  COMPLETED: { label: 'Verified', tone: 'is-verified' },
  LEFT: { label: 'Left', tone: '' },
};

const WHY: Record<SimAnalytics['students'][number]['why'], string> = {
  'handed-in': 'Handed in',
  shared: 'Shared with you',
  'sent-a-test': 'Sent a test',
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: "Who's taking it" },
  { key: 'tasks', label: 'Tasks and tests' },
  { key: 'students', label: 'Students' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/**
 * How one of the company's simulations is being used: how many start it and
 * where they are now, who they are, how far they get task by task, how they
 * do on each test, and the students who chose to show the company their work.
 */
export default function CompanyAnalytics() {
  const { id = '' } = useParams();
  const [data, setData] = useState<SimAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.slice(1);
    return (TABS.find((t) => t.key === h)?.key ?? 'overview') as Tab;
  });

  useEffect(() => {
    companyAppApi
      .analytics(id)
      .then(setData)
      .catch((e) => setError(message(e, 'Could not load the analytics.')));
  }, [id]);

  function go(t: Tab) {
    setTab(t);
    window.history.replaceState(null, '', `#${t}`);
  }

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">
            <Link to="/company/simulations" className="sa-link">
              Simulations
            </Link>{' '}
            · Analytics
          </p>
          <div className="an-head">
            <h1>{data?.simulation.title ?? 'Analytics'}</h1>
            {data && (
              <span className={`ca-chip is-${data.simulation.status.toLowerCase()}`}>
                {STATUS_LABEL[data.simulation.status]}
              </span>
            )}
          </div>
          <p className="sa-lede">
            Everyone who starts is counted. Students appear by name once they hand the simulation in to you, share it
            with you, or send you a test.
          </p>
          <div className="sd-tabs" role="tablist" aria-label="Analytics">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'is-on' : ''}
                onClick={() => go(t.key)}
              >
                {t.key === 'students' && data ? `Students (${data.students.length})` : t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!data && !error && <p className="sa-loading">Loading…</p>}
        {data && data.status.started === 0 && (
          <p className="sa-empty">
            No one has started this simulation yet.{' '}
            {data.simulation.status === 'LIVE'
              ? 'Numbers appear here as soon as the first student does.'
              : 'Students can start it once it is live.'}
          </p>
        )}
        {data && data.status.started > 0 && (
          <>
            {tab === 'overview' && <Overview data={data} />}
            {tab === 'people' && <People data={data} />}
            {tab === 'tasks' && <Tasks data={data} />}
            {tab === 'students' && <Students data={data} />}
          </>
        )}
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */

function Overview({ data }: { data: SimAnalytics }) {
  const s = data.status;
  const parts = [
    { key: 'working', label: 'Working', n: s.working - s.stalled, tone: 'is-blue' },
    { key: 'stalled', label: `Quiet ${s.stalledAfterDays}+ days`, n: s.stalled, tone: 'is-grey' },
    { key: 'review', label: 'To review', n: s.toReview, tone: 'is-violet' },
    { key: 'changes', label: 'Changes asked', n: s.changesAsked, tone: 'is-orange' },
    { key: 'verified', label: 'Verified', n: s.verified, tone: 'is-green' },
    { key: 'left', label: 'Left', n: s.left, tone: 'is-line' },
  ].filter((p) => p.n > 0);
  const peak = Math.max(1, ...data.weeks.map((w) => Math.max(w.started, w.finished)));
  const first = data.tasks[0]?.reached || 1;

  return (
    <div className="an-grid">
      <div className="an-kpis">
        <Kpi label="Started" value={s.started} />
        <Kpi label="Working now" value={s.working} sub={s.stalled ? `${s.stalled} quiet ${s.stalledAfterDays}+ days` : undefined} />
        <Kpi label="To review" value={s.toReview} to={s.toReview ? '/company/reviews' : undefined} />
        <Kpi label="Verified" value={s.verified} sub={`${percent(s.completionRate)} of starters`} />
        <Kpi
          label="Time to finish"
          value={s.medianDaysToFinish === null ? '—' : `${s.medianDaysToFinish} d`}
          sub="middle student, start to verified"
        />
        <Kpi label="Rating" value={s.rating === null ? '—' : `${s.rating} ★`} sub={`${s.ratings} review${s.ratings === 1 ? '' : 's'}`} />
      </div>

      <section className="sa-panel an-card">
        <h2>Where everyone is</h2>
        <div className="an-stack" role="img" aria-label={parts.map((p) => `${p.label}: ${p.n}`).join(', ')}>
          {parts.map((p) => (
            <span key={p.key} className={p.tone} style={{ flexGrow: p.n }} />
          ))}
        </div>
        <ul className="an-legend">
          {parts.map((p) => (
            <li key={p.key}>
              <i className={p.tone} aria-hidden="true" />
              {p.label} <b>{p.n}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="sa-panel an-card">
        <h2>Last 12 weeks</h2>
        <div className="an-weeks">
          {data.weeks.map((w) => (
            <div key={w.week} className="an-week" title={`Week of ${day(w.week)}: ${w.started} started, ${w.finished} verified`}>
              <div className="an-week-bars">
                <span className="is-blue" style={{ height: `${(w.started / peak) * 100}%` }} />
                <span className="is-green" style={{ height: `${(w.finished / peak) * 100}%` }} />
              </div>
              <small>{day(w.week)}</small>
            </div>
          ))}
        </div>
        <ul className="an-legend">
          <li>
            <i className="is-blue" aria-hidden="true" />
            Started
          </li>
          <li>
            <i className="is-green" aria-hidden="true" />
            Verified
          </li>
        </ul>
      </section>

      <section className="sa-panel an-card an-wide">
        <h2>How far they get</h2>
        <p className="an-note">Each task: how many reached it, and how many handed it in.</p>
        <ol className="an-funnel">
          {data.tasks.map((t) => (
            <li key={t.id}>
              <span className="an-funnel-name">
                {t.position}. {t.title}
              </span>
              <span className="an-bar">
                <span className="is-line" style={{ width: `${(t.reached / first) * 100}%` }} />
                <span className="is-blue" style={{ width: `${(t.handedIn / first) * 100}%` }} />
              </span>
              <span className="an-funnel-num">
                {t.handedIn} of {t.reached}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, to }: { label: string; value: number | string; sub?: string; to?: string }) {
  const body = (
    <>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </>
  );
  return to ? (
    <Link to={to} className="an-kpi is-link">
      {body}
    </Link>
  ) : (
    <div className="an-kpi">{body}</div>
  );
}

/* -------------------------------------------------------------------------- */

function People({ data }: { data: SimAnalytics }) {
  const groups: { title: string; g: SimAnalytics['who'][keyof SimAnalytics['who']] }[] = [
    { title: 'Colleges', g: data.who.colleges },
    { title: 'Courses', g: data.who.courses },
    { title: 'Branches', g: data.who.branches },
    { title: 'Year of passing', g: data.who.classOf },
    { title: 'Level of study', g: data.who.levels },
    { title: 'Cities', g: data.who.cities },
  ];
  return (
    <div className="an-people">
      {groups.map(({ title, g }) => {
        const top = Math.max(1, ...g.rows.map((r) => r.count));
        return (
          <section key={title} className="sa-panel an-card">
            <h2>{title}</h2>
            {g.rows.length === 0 ? (
              <p className="an-note">Not given yet.</p>
            ) : (
              <ul className="an-bars">
                {g.rows.map((r) => (
                  <li key={r.label}>
                    <span className="an-bars-label">{r.label}</span>
                    <span className="an-bar">
                      <span className="is-blue" style={{ width: `${(r.count / top) * 100}%` }} />
                    </span>
                    <b>{r.count}</b>
                  </li>
                ))}
              </ul>
            )}
            {g.missing > 0 && g.rows.length > 0 && <p className="an-note">{g.missing} did not say.</p>}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Tasks({ data }: { data: SimAnalytics }) {
  return (
    <div className="an-tasks">
      {data.tasks.map((t, i) => {
        const prev = i === 0 ? null : data.tasks[i - 1]!;
        const lost = prev ? prev.reached - t.reached : 0;
        return (
          <section key={t.id} className="sa-panel an-card">
            <div className="an-task-head">
              <h2>
                Task {t.position}. {t.title}
              </h2>
              <span className="an-note">
                {t.reached} reached · {t.handedIn} handed in
                {prev && lost > 0 ? ` · ${lost} stopped before it` : ''}
              </span>
            </div>
            {t.tests.length === 0 ? (
              <p className="an-note">This task has no test.</p>
            ) : (
              t.tests.map((x) => (
                <div key={x.id} className="an-test">
                  <h3>{x.title}</h3>
                  <dl className="an-test-facts">
                    <div>
                      <dt>Took it</dt>
                      <dd>{x.takers}</dd>
                    </div>
                    <div>
                      <dt>First try</dt>
                      <dd>{x.graded ? percent(x.firstTry) : 'Written'}</dd>
                    </div>
                    <div>
                      <dt>Latest try</dt>
                      <dd>{x.graded ? percent(x.latest) : 'Written'}</dd>
                    </div>
                    <div>
                      <dt>Tries each</dt>
                      <dd>{x.averageTries ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Saw answers</dt>
                      <dd>{x.sawAnswers}</dd>
                    </div>
                    <div>
                      <dt>Sent to you</dt>
                      <dd>{x.sent}</dd>
                    </div>
                  </dl>
                  <ol className="an-questions">
                    {x.questions.map((q, k) => (
                      <li key={k} className={q.firstTryRight !== null && q.firstTryRight < 50 ? 'is-hard' : ''}>
                        <span className="an-q-text">
                          <b>{k + 1}.</b> {q.prompt}
                        </span>
                        {q.firstTryRight === null ? (
                          <span className="an-note">Written - you judge it</span>
                        ) : (
                          <>
                            <span className="an-bar is-small">
                              <span
                                className={q.firstTryRight < 50 ? 'is-orange' : 'is-green'}
                                style={{ width: `${q.firstTryRight}%` }}
                              />
                            </span>
                            <b className="an-q-pct">{q.firstTryRight}%</b>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p className="an-note">Per question: who had it right on their first try. Under half is marked as hard.</p>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Students({ data }: { data: SimAnalytics }) {
  const [task, setTask] = useState<string>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.students.filter(
      (s) =>
        !needle || [s.name, s.college, s.course, s.city].filter(Boolean).some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [data.students, q]);
  const picked = data.tasks.find((t) => t.id === task);
  const total = data.tasks.length;

  return (
    <div className="an-students">
      <div className="an-filters">
        <label>
          <span>Task</span>
          <select value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="all">All tasks</option>
            {data.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                Task {t.position}. {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="an-search">
          <span>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, college, course or city" />
        </label>
      </div>

      {data.students.length === 0 ? (
        <p className="sa-empty">
          No one has shown you their work yet. Students appear here when they hand the simulation in, share it with you,
          or send you a test.
        </p>
      ) : rows.length === 0 ? (
        <p className="sa-empty">No student matches that.</p>
      ) : (
        <div className="ca-table-wrap">
          <table className="ca-table an-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>{picked ? `Task ${picked.position}` : 'Tasks'}</th>
                <th>{picked ? 'Test scores' : 'Started'}</th>
                <th>Why you see them</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const t = picked ? s.tasks.find((x) => x.taskId === picked.id) : undefined;
                const isOpen = open === s.runId;
                return (
                  <StudentRow
                    key={s.runId}
                    s={s}
                    data={data}
                    isOpen={isOpen}
                    onToggle={() => setOpen(isOpen ? null : s.runId)}
                    progress={
                      picked
                        ? t?.handedInAt
                          ? `Handed in ${day(t.handedInAt)}`
                          : 'Not handed in'
                        : `${s.tasksDone} of ${total} handed in`
                    }
                    scores={
                      picked
                        ? t?.tests.length
                          ? t.tests.map((x) => `${x.title}: ${scoreOf(x)}`).join(' · ')
                          : 'No test'
                        : day(s.startedAt)
                    }
                    only={picked?.id}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data.anonymous > 0 && (
        <p className="an-note">
          {data.anonymous} more student{data.anonymous === 1 ? '' : 's'} started but {data.anonymous === 1 ? 'has' : 'have'}{' '}
          not shown you their work. They are counted in the other tabs.
        </p>
      )}
    </div>
  );
}

type Test = SimAnalytics['students'][number]['tasks'][number]['tests'][number];

/** The score the company may see: the latest if it may see everything, else the last try sent. */
function scoreOf(x: Test) {
  if (x.latest) return x.latest.total ? `${x.latest.score}/${x.latest.total}` : 'written';
  const last = x.visible[x.visible.length - 1];
  if (!last) return x.tries ? 'not sent' : 'not taken';
  return last.total ? `${last.score}/${last.total} (sent)` : 'written (sent)';
}

function StudentRow({
  s,
  data,
  isOpen,
  onToggle,
  progress,
  scores,
  only,
}: {
  s: SimAnalytics['students'][number];
  data: SimAnalytics;
  isOpen: boolean;
  onToggle: () => void;
  progress: string;
  scores: string;
  only?: string;
}) {
  const run = RUN[s.status];
  return (
    <>
      <tr className={isOpen ? 'is-open' : ''}>
        <td>
          <button type="button" className="an-name" onClick={onToggle} aria-expanded={isOpen}>
            {s.name}
          </button>
          <span className="ca-table-sub">{[s.college, s.course, s.batch].filter(Boolean).join(' · ') || 'Student'}</span>
        </td>
        <td>
          <span className={`sa-status ${run.tone}`}>{run.label}</span>
        </td>
        <td>{progress}</td>
        <td>{scores}</td>
        <td>
          <span className="an-why">{WHY[s.why]}</span>
        </td>
      </tr>
      {isOpen && (
        <tr className="an-detail">
          <td colSpan={5}>
            <p className="ca-contact">
              <a href={`mailto:${s.email}`}>{s.email}</a>
              {s.phone && <span>{s.phone}</span>}
              {s.city && <span>{s.city}</span>}
              <span>
                Started {day(s.startedAt)} · last active {day(s.lastActiveAt)}
                {s.completedAt ? ` · verified ${day(s.completedAt)}` : ''}
              </span>
            </p>
            <OfferButton candidateId={s.candidateId} runId={s.runId} name={s.name} />
            {s.why === 'sent-a-test' && (
              <p className="an-note">They sent you a test, so you see the tries they sent - not the rest of their work.</p>
            )}
            {s.tasks
              .filter((t) => !only || t.taskId === only)
              .map((t) => {
                const meta = data.tasks.find((x) => x.id === t.taskId)!;
                return (
                  <div key={t.taskId} className="an-student-task">
                    <h3>
                      Task {meta.position}. {meta.title}
                      <span className="an-note">{t.handedInAt ? `Handed in ${day(t.handedInAt)}` : 'Not handed in'}</span>
                    </h3>
                    {t.tests.length === 0 && <p className="an-note">No test in this task.</p>}
                    {t.tests.map((x) => (
                      <div key={x.pageId} className="an-student-test">
                        <p className="an-student-test-head">
                          <b>{x.title}</b>
                          <span>
                            {scoreOf(x)} · {x.tries} tr{x.tries === 1 ? 'y' : 'ies'}
                            {x.sawAnswers ? ' · saw the answers' : ''}
                          </span>
                        </p>
                        {x.visible.length > 0 && (
                          <ul className="qc-tries-inline">
                            {x.visible.map((v) => (
                              <li key={v.number}>
                                Try {v.number}: {v.total ? `${v.score}/${v.total}` : 'written'}
                                {v.sent && <em>Sent</em>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {x.answers && (
                          <details className="an-answers">
                            <summary>Answers in try {x.answers.number}</summary>
                            <ol className="ca-test-answers">
                              {x.answers.questions.map((qn, i) => (
                                <li key={i} className={qn.correct === null ? 'is-written' : qn.correct ? 'is-right' : 'is-wrong'}>
                                  <p className="ca-test-q">
                                    <b>{i + 1}.</b> {qn.prompt}
                                    <span>{qn.correct === null ? 'For you to judge' : qn.correct ? 'Right' : 'Not right'}</span>
                                  </p>
                                  {qn.kind === 'text' ? (
                                    <p className="ca-test-written">{qn.answer[0] || 'No answer.'}</p>
                                  ) : (
                                    <div className="ca-test-cols">
                                      <div>
                                        <h4>Their answer</h4>
                                        <AnswerList kind={qn.kind} items={qn.answer} />
                                      </div>
                                      {!qn.correct && (
                                        <div>
                                          <h4>Right answer</h4>
                                          <AnswerList kind={qn.kind} items={qn.right} />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
          </td>
        </tr>
      )}
    </>
  );
}
