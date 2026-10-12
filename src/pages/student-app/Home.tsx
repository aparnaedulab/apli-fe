import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  studentAppApi,
  type ActivityEvent,
  type Certificate,
  type Dashboard,
  type InProgress,
} from '../../api/studentApp';
import Shell, { CompanyTile, SimulationTile } from './Shell';
import ShareDialog from './Share';

/**
 * The student dashboard: an overview of everything, on one screen.
 *
 * At the top, one sentence on what needs them and how complete their
 * profile is. Then four numbers that sum up their work so far. Below, the
 * two things they act on - what is on the go, and what to try next - and
 * beside them what they have built up: verified work, recent activity, the
 * skills they have practised and how far they have got in each field.
 */
export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Certificate | null>(null);

  const load = useCallback(() => {
    studentAppApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your dashboard.'));
  }, []);

  useEffect(load, [load]);

  // Gone at once; the server is told in the background.
  function hide(kind: 'suggestion' | 'run', id: string) {
    setData(
      (d) =>
        d && {
          ...d,
          suggested: kind === 'suggestion' ? d.suggested.filter((s) => s.id !== id) : d.suggested,
          inProgress: kind === 'run' ? d.inProgress.filter((r) => r.runId !== id) : d.inProgress,
        },
    );
    studentAppApi.dismiss(kind, id).catch(load);
  }

  return (
    <Shell>
      <section className="sa-hero is-overview">
        <div className="sa-wrap sa-ov-head">
          <div>
            <p className="sa-eyebrow">{today()}</p>
            <h1>
              {greeting()}, <span className="sa-mark">{data?.firstName || 'there'}</span>
            </h1>
            <p className="sa-lede">{data ? summary(data) : 'Getting your dashboard ready…'}</p>
          </div>
          {data && <ProfileRing data={data} />}
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!data && !error && <Skeleton />}
        {data && (
          <>
            <ul className="sa-kpis">
              <Kpi
                tone="blue"
                value={data.stats.tasksHandedIn}
                label="Tasks handed in"
                hint={data.stats.tasksHandedIn ? 'Across every simulation' : 'Start one to begin'}
              />
              <Kpi
                tone="violet"
                value={data.inProgress.length}
                label="On the go"
                hint={
                  data.inProgress.filter((r) => r.status === 'IN_REVIEW').length
                    ? `${data.inProgress.filter((r) => r.status === 'IN_REVIEW').length} with a reviewer`
                    : 'In progress right now'
                }
              />
              <Kpi
                tone="green"
                value={data.certificates.length}
                label="Verified"
                hint={data.stats.hoursVerified ? `${data.stats.hoursVerified} hours of approved work` : 'Approved by a reviewer'}
              />
              <Kpi
                tone="orange"
                value={data.sharedCount}
                label="Companies seeing your work"
                hint={data.sharedCount ? 'Only the ones you chose' : 'Nothing shared yet'}
              />
            </ul>

            <div className="sa-layout is-overview">
              <div className="sa-main-col">
                <section className="sa-block">
                  <div className="sa-block-head">
                    <div>
                      <h2>Continue</h2>
                      <p>Everything on the go, and what each one is waiting for.</p>
                    </div>
                  </div>
                  {data.inProgress.length === 0 ? (
                    <p className="sa-empty">
                      Nothing on the go. Pick one below - most take an afternoon or two.
                    </p>
                  ) : (
                    <ul className="sa-rows">
                      {data.inProgress.map((r, i) => (
                        <RunRow key={r.runId} run={r} index={i} onHide={() => hide('run', r.runId)} />
                      ))}
                    </ul>
                  )}
                </section>

                <section className="sa-block">
                  <div className="sa-block-head">
                    <div>
                      <h2>Picked for you</h2>
                      <p>{data.interests.length ? `Your fields first: ${data.interests.join(', ')}.` : 'The newest, from every field.'}</p>
                    </div>
                    <Link to="/student/simulations" className="sa-link">
                      {data.moreToTry > 0 ? `${data.moreToTry} more` : 'Browse all'} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                  {data.suggested.length === 0 ? (
                    <p className="sa-empty">Nothing new to try right now. Companies add more every week.</p>
                  ) : (
                    <div className="sa-grid is-three">
                      {data.suggested.map((s, i) => (
                        <SimulationTile key={s.id} i={s} index={i} onHide={() => hide('suggestion', s.id)} />
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="sa-aside">
                <section className="sa-panel is-white">
                  <h2>Verified work</h2>
                  {data.certificates.length === 0 ? (
                    <p className="sa-panel-empty">
                      When a reviewer approves your work, its certificate appears here with a code anyone can check.
                    </p>
                  ) : (
                    <ul className="sa-verified">
                      {data.certificates.map((c) => (
                        <li key={c.runId}>
                          <span className="sa-seal" aria-hidden="true">
                            ✓
                          </span>
                          <div>
                            <Link to={`/student/simulations/${c.simulation.slug}`}>{c.simulation.title}</Link>
                            <span>
                              {c.simulation.company.name} · <code>{c.certificateCode}</code>
                            </span>
                            <button type="button" className={`sa-share-btn ${c.sharedWith.length ? 'is-on' : ''}`} onClick={() => setSharing(c)}>
                              <span>
                                {c.sharedWith.length ? `Shared with ${c.sharedWith.map((x) => x.name).join(', ')}` : 'Private'}
                              </span>
                              <b>{c.sharedWith.length ? 'Change' : 'Share'}</b>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="sa-panel is-white">
                  <h2>Recent activity</h2>
                  {data.activity.length === 0 ? (
                    <p className="sa-panel-empty">What you start, hand in and get approved shows up here.</p>
                  ) : (
                    <ol className="sa-timeline">
                      {data.activity.map((a, i) => (
                        <Activity key={`${a.at}-${i}`} a={a} />
                      ))}
                    </ol>
                  )}
                </section>

                <section className="sa-panel is-white">
                  <h2>Skills you have practised</h2>
                  {data.skills.length === 0 ? (
                    <p className="sa-panel-empty">Each simulation lists the skills it uses. Start one and they gather here.</p>
                  ) : (
                    <>
                      <div className="sa-skillcloud">
                        {data.skills.map((s) => (
                          <span key={s.name} className={s.verified ? 'is-verified' : ''} title={s.verified ? 'In verified work' : 'Practising'}>
                            {s.verified && <b aria-hidden="true">✓</b>}
                            {s.name}
                          </span>
                        ))}
                      </div>
                      <p className="sa-panel-empty is-small">✓ marks skills in work a reviewer has approved.</p>
                    </>
                  )}
                </section>

                <section className="sa-panel is-white">
                  <div className="sa-panel-head">
                    <h2>Your fields</h2>
                    <Link to="/student/profile" className="sa-link is-small">
                      Change
                    </Link>
                  </div>
                  {data.fields.length === 0 ? (
                    <p className="sa-panel-empty">Pick up to three in your profile, and those come first.</p>
                  ) : (
                    <ul className="sa-fieldbars">
                      {data.fields.map((f) => {
                        const total = Math.max(f.open, f.verified + f.started, 1);
                        return (
                          <li key={f.field}>
                            <Link to={`/student/simulations?field=${encodeURIComponent(f.field)}`}>
                              <span className="sa-fieldbars-top">
                                <b>{f.field}</b>
                                <span>
                                  {f.verified} verified · {f.started} on the go · {f.open} in all
                                </span>
                              </span>
                              <span className="sa-fieldbars-bar">
                                <i className="is-verified" style={{ width: `${(f.verified / total) * 100}%` }} />
                                <i className="is-started" style={{ width: `${(f.started / total) * 100}%` }} />
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
      </div>

      {sharing && (
        <ShareDialog runId={sharing.runId} title={sharing.simulation.title} onClose={() => setSharing(null)} onSaved={() => load()} />
      )}
    </Shell>
  );
}

/** One plain sentence about what needs them, from what is on the go. */
function summary(d: Dashboard): string {
  const parts: string[] = [];
  const changes = d.inProgress.filter((r) => r.status === 'NEEDS_WORK').length;
  const explain = d.inProgress.filter((r) => r.readyToExplain).length;
  const going = d.inProgress.filter((r) => r.status === 'ACTIVE' && !r.readyToExplain).length;
  const review = d.inProgress.filter((r) => r.status === 'IN_REVIEW').length;
  if (changes) parts.push(`${changes} sent back with changes to make`);
  if (explain) parts.push(`${explain} ready for your explanation`);
  if (going) parts.push(`${going} to continue`);
  if (review) parts.push(`${review} with a reviewer`);
  if (!parts.length) {
    return d.certificates.length
      ? 'Nothing waiting on you. A good day to start something new.'
      : 'Pick a simulation below to get started - most take an afternoon or two.';
  }
  return `You have ${readable(parts)}.`;
}

/** The profile, as a ring that fills - and what would fill it. */
function ProfileRing({ data }: { data: Dashboard }) {
  const pct = data.profile.complete;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <Link to="/student/profile" className="sa-ring-card">
      <svg viewBox="0 0 56 56" className="sa-ring" aria-hidden="true">
        <circle cx="28" cy="28" r={r} className="sa-ring-track" />
        <circle
          cx="28"
          cy="28"
          r={r}
          className="sa-ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
        <text x="28" y="32" textAnchor="middle">
          {pct}%
        </text>
      </svg>
      <span>
        <b>{pct === 100 ? 'Profile complete' : 'Your profile'}</b>
        <span>{pct === 100 ? 'Everything a company looks for' : `Add ${data.profile.missing.map((m) => m.label.toLowerCase()).slice(0, 2).join(' and ')}`}</span>
      </span>
    </Link>
  );
}

function Kpi({ tone, value, label, hint }: { tone: string; value: number; label: string; hint: string }) {
  return (
    <li className={`sa-kpi is-${tone}`}>
      <b>{value}</b>
      <span className="sa-kpi-label">{label}</span>
      <span className="sa-kpi-hint">{hint}</span>
    </li>
  );
}

/** One simulation on the go, as a row: who, what, how far, and the one right button. */
function RunRow({ run, index, onHide }: { run: InProgress; index: number; onHide: () => void }) {
  const total = run.tasksDone + run.tasksLeft;
  const to = `/student/simulations/${run.simulation.slug}`;
  const action =
    run.status === 'IN_REVIEW'
      ? null
      : run.status === 'NEEDS_WORK'
        ? 'Make changes'
        : run.readyToExplain
          ? 'Explain your work'
          : 'Continue';
  return (
    <li className={`sa-row is-${run.status.toLowerCase()}`} style={{ '--d': index } as CSSProperties}>
      <CompanyTile company={run.simulation.company} />
      <div className="sa-row-main">
        <div className="sa-row-title">
          <Link to={to}>{run.simulation.title}</Link>
          <StatusChip run={run} />
        </div>
        <span className="sa-row-sub">
          {run.simulation.company.name} · {ago(run.lastActiveAt)}
        </span>
        {run.status === 'NEEDS_WORK' && run.reviewNote ? (
          <span className="sa-row-note">
            <b>Reviewer:</b> {run.reviewNote}
          </span>
        ) : run.status === 'ACTIVE' && run.nextTask ? (
          <span className="sa-row-next">
            Next: {run.nextTask.title} · ~{run.nextTask.minutes} min
          </span>
        ) : run.status === 'IN_REVIEW' ? (
          <span className="sa-row-next">A reviewer will read it and reply here.</span>
        ) : null}
      </div>
      <div className="sa-row-progress" aria-label={`${run.tasksDone} of ${total} tasks handed in`}>
        <div className="sa-steps">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < run.tasksDone ? 'is-done' : i === run.tasksDone ? 'is-next' : ''} />
          ))}
        </div>
        <span>
          {run.tasksDone}/{total} tasks
        </span>
      </div>
      <div className="sa-row-act">
        {action && (
          <Link to={to} className="sa-btn is-small">
            {action}
          </Link>
        )}
        {run.status === 'ACTIVE' && (
          <button type="button" className="sa-bcard-x" onClick={onHide} aria-label={`Take off the dashboard: ${run.simulation.title}`} title="Take off the dashboard">
            ×
          </button>
        )}
      </div>
    </li>
  );
}

function StatusChip({ run }: { run: InProgress }) {
  if (run.status === 'IN_REVIEW') return <span className="sa-status is-review">In review</span>;
  if (run.status === 'NEEDS_WORK') return <span className="sa-status is-changes">Changes asked</span>;
  if (run.readyToExplain) return <span className="sa-status is-explain">Explain</span>;
  return <span className="sa-status is-working">In progress</span>;
}

const ACTIVITY_ICON: Record<ActivityEvent['kind'], string> = {
  started: '▶',
  'handed-in': '↑',
  sent: '✉',
  changes: '↺',
  verified: '✓',
};

function Activity({ a }: { a: ActivityEvent }) {
  return (
    <li className={`is-${a.kind}`}>
      <span className="sa-tl-dot" aria-hidden="true">
        {ACTIVITY_ICON[a.kind]}
      </span>
      <Link to={`/student/simulations/${a.slug}`}>{a.text}</Link>
      <time dateTime={a.at}>{ago(a.at, true)}</time>
    </li>
  );
}

/** Placeholders in the overview's own shape while it loads. */
function Skeleton() {
  return (
    <div aria-label="Loading your dashboard">
      <div className="sa-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sa-skel is-kpi" />
        ))}
      </div>
      <div className="sa-layout is-overview">
        <div className="sa-main-col">
          <div className="sa-skel is-row" />
          <div className="sa-skel is-row" />
          <div className="sa-skel" />
        </div>
        <div className="sa-aside">
          <div className="sa-skel" />
          <div className="sa-skel" />
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Monday, 12 October" */
function today(): string {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "Worked on 3 days ago" - or, short, "3d ago". */
function ago(iso: string, short = false): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(ms / 86400000);
  if (short) {
    if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  if (days <= 0) return 'worked on today';
  if (days === 1) return 'worked on yesterday';
  if (days < 30) return `worked on ${days} days ago`;
  return `last worked on ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

/** ["a", "b", "c"] -> "a, b and c" */
function readable(list: string[]): string {
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** A progress bar, used on a simulation's own page. */
export function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="sa-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  );
}
