import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { refreshMe } from './me';
import {
  candidateApi,
  studentJobsApi,
  type JobCard,
  type MyApplication,
  type Profile,
} from '../../api/candidate';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n';
import NoticeBoard from '../../components/NoticeBoard';
import StudentDrives from '../../components/StudentDrives';
import './Home.css';

/**
 * The first screen a student sees: their placement season as a path.
 *
 *   Profile → Verified → Applied → Rounds → Offer → Day one
 *
 * That path is the product's own promise drawn on the screen - Apli.ai
 * follows a student from a finished profile to their first day at work - so
 * the page is about where this student is on it rather than a grid of
 * widgets. Done milestones are filled in, "you are here" pulses, and the
 * one thing to do now hangs from it. Nothing else competes.
 *
 * It never looks empty: a new student still sees the whole road, with the
 * marker at its start.
 */

/** The statuses that still have somewhere to go. */
const LIVE = new Set(['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'IN_ROUND', 'WAITLISTED', 'OFFERED']);
const MOVED = new Set(['SHORTLISTED', 'IN_ROUND', 'WAITLISTED', 'OFFERED', 'ACCEPTED', 'HIRED']);
const OFFERED = new Set(['OFFERED', 'ACCEPTED', 'HIRED']);

const STATUS: Record<string, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Being reviewed',
  SHORTLISTED: 'Shortlisted',
  IN_ROUND: 'In a round',
  WAITLISTED: 'Waitlisted',
  OFFERED: 'Offer waiting',
};

const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
const dateOf = (at: number) => new Date(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const timeOf = (at: number) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Rupees a year, as a student reads a package: "₹6.2 L". */
function lakhs(v: string | null | undefined): string | null {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return null;
  return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)} L`;
}

function pay(j: JobCard): string | null {
  const lo = lakhs(j.ctcMin);
  const hi = lakhs(j.ctcMax);
  if (lo && hi && lo !== hi) return `${lo} – ${hi}`;
  return lo ?? hi;
}

function partOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Due {
  key: string;
  at: number;
  kind: 'interview' | 'closes';
  title: string;
  to: string;
}

const MILESTONES = [
  { key: 'profile', label: 'Profile' },
  { key: 'verified', label: 'Verified' },
  { key: 'applied', label: 'Applied' },
  { key: 'rounds', label: 'Rounds' },
  { key: 'offer', label: 'Offer' },
  { key: 'dayone', label: 'Day one' },
] as const;

type Stage = (typeof MILESTONES)[number]['key'] | 'done';

export default function StudentDashboard() {
  const { t } = useT();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<JobCard[] | null>(null);
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    candidateApi
      .getProfile()
      .then(setProfile)
      // '' stands for "our own message", which is translated when shown.
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : ''));
    studentJobsApi
      .list()
      .then((r) => setJobs(r.jobs))
      .catch(() => setJobs([]));
    studentJobsApi
      .applications()
      .then(setApps)
      .catch(() => setApps([]));
  }, []);

  useEffect(load, [load]);

  const verified = profile?.batch?.isFrozen ?? false;
  const percent = profile?.completion.percent ?? 0;
  const sections = profile?.completion.sections ?? [];
  const all = apps ?? [];

  const open = useMemo(() => (jobs ?? []).filter((j) => !j.applicationStatus), [jobs]);
  const live = useMemo(() => all.filter((a) => LIVE.has(a.status)), [all]);
  const best = useMemo(() => [...open].sort((a, b) => b.match.score - a.match.score).slice(0, 8), [open]);

  /** Which milestones are behind them. Not strictly in order: a record can be verified before the profile is finished. */
  const done: Record<(typeof MILESTONES)[number]['key'], boolean> = {
    profile: percent === 100,
    verified,
    applied: all.some((a) => a.status !== 'WITHDRAWN'),
    rounds: all.some((a) => MOVED.has(a.status)),
    offer: all.some((a) => OFFERED.has(a.status)),
    dayone: all.some((a) => a.status === 'HIRED'),
  };
  const hereIndex = MILESTONES.findIndex((m) => !done[m.key]);
  const stage: Stage = hereIndex === -1 ? 'done' : MILESTONES[hereIndex]!.key;

  /** Interviews and closing dates in the next week, in time order. */
  const due = useMemo<Due[]>(() => {
    const out: Due[] = [];
    const now = Date.now();
    for (const a of all) {
      if (a.status !== 'IN_ROUND') continue;
      const round = a.rounds.find((r) => r.id === a.currentRound?.id);
      if (!round?.scheduledAt) continue;
      const at = new Date(round.scheduledAt).getTime();
      if (at > now && at - now < 7 * 86_400_000) {
        out.push({ key: `iv-${a.id}`, at, kind: 'interview', title: `${timeOf(at)} · ${round.name}, ${a.companyName}`, to: '/student/interviews' });
      }
    }
    for (const j of open) {
      const d = daysTo(j.deadline);
      if (d >= 0 && d <= 7) {
        out.push({ key: `cl-${j.id}`, at: new Date(j.deadline).getTime(), kind: 'closes', title: `${j.companyName} closes`, to: `/student/jobs/${j.id}` });
      }
    }
    return out.sort((a, b) => a.at - b.at).slice(0, 6);
  }, [all, open]);

  const loading = !profile && error === null;
  const first = profile?.fullName.split(' ')[0] ?? '';

  return (
    <StudentLayout>
      <NoticeBoard />
      <StudentDrives />

      {error !== null && <p className="alert alert-error">{error || t('dash.loadError')}</p>}

      {loading && (
        <div className="jy" aria-busy="true">
          <div className="sk jy-sk-head" />
          <div className="sk jy-sk-path" />
          <div className="sk jy-sk-card" />
        </div>
      )}

      {profile && (
        <div className="jy">
          {/* One compact head, like Jobs and Applications: who, on the left;
              the four numbers that matter, as pills you can open, on the right. */}
          <header className="jy-top">
            <div>
              <h1>
                {partOfDay()}, {first}
              </h1>
              <p className="jy-top-sub">
                {[profile.batch?.course, profile.batch?.graduationYear].filter(Boolean).join(' · ')}
                {profile.cgpa ? ` · CGPA ${profile.cgpa}` : ''}
                <span className={`jy-verified ${verified ? 'is-ok' : ''}`}>
                  {verified ? '✓ Verified by your college' : 'Verification pending'}
                </span>
              </p>
            </div>
            <nav className="jy-counts" aria-label="At a glance">
              <Link to="/student/jobs" className={open.length ? 'is-on' : ''}>
                Open to you <b>{open.length}</b>
              </Link>
              <Link to="/student/applications" className={live.length ? 'is-on' : ''}>
                Applied <b>{live.length}</b>
              </Link>
              <Link to="/student/interviews" className={due.some((d) => d.kind === 'interview') ? 'is-on' : ''}>
                Interviews <b>{due.filter((d) => d.kind === 'interview').length}</b>
              </Link>
              <Link
                to="/student/applications"
                className={all.some((a) => a.status === 'OFFERED') ? 'is-hot' : all.some((a) => ['ACCEPTED', 'HIRED'].includes(a.status)) ? 'is-on' : ''}
              >
                Offers <b>{all.filter((a) => ['OFFERED', 'ACCEPTED', 'HIRED'].includes(a.status)).length}</b>
              </Link>
            </nav>
          </header>

          {/* --- the path, as a slim track ----------------------------------- */}
          <section
            className="jy-road is-slim"
            aria-label="Your placement journey"
            style={{ '--here': Math.max(0, hereIndex === -1 ? MILESTONES.length - 1 : hereIndex), '--n': MILESTONES.length } as CSSProperties}
          >
            <ol className="jy-path">
              {MILESTONES.map((m, i) => {
                const isHere = i === hereIndex;
                const isDone = done[m.key];
                return (
                  <li
                    key={m.key}
                    className={`jy-stop ${isDone ? 'is-done' : ''} ${isHere ? 'is-here' : ''} ${i < hereIndex || hereIndex === -1 ? 'is-behind' : ''}`}
                    aria-current={isHere ? 'step' : undefined}
                  >
                    <span className="jy-node" aria-hidden="true">
                      {isDone ? '✓' : i + 1}
                    </span>
                    <span className="jy-label">
                      {m.label}
                      {isHere && <span className="jy-here">You are here</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* --- two columns: the next step, and what is going on ---------- */}
          {(() => {
            const showMotion = live.length > 0 && stage !== 'applied' && stage !== 'rounds';
            const hasSide = due.length > 0 || showMotion;
            return (
              <div className={`jy-cols ${hasSide ? '' : 'is-single'}`}>
                <div className="jy-main">
                  <Next
                    stage={stage}
                    profile={profile}
                    sections={sections}
                    percent={percent}
                    verified={verified}
                    roles={best}
                    openCount={open.length}
                    live={live}
                    due={due}
                    apps={all}
                    onSkillAdded={() => {
                      load();
                      refreshMe();
                    }}
                  />

                  {(stage === 'profile' || stage === 'verified') && (
                    <Waiting roles={best.slice(0, 3)} total={open.length} stage={stage} />
                  )}
                </div>

                {hasSide && (
                  <aside className="jy-side">
                    {due.length > 0 && (
                      <section className="jy-side-card" aria-label="This week">
                        <h3>This week</h3>
                        <ul className="jy-days">
                          {due.map((d) => (
                            <li key={d.key} className={`is-${d.kind}`}>
                              <Link to={d.to}>
                                <span className="jy-day">
                                  <b>{new Date(d.at).getDate()}</b>
                                  <i>{new Date(d.at).toLocaleDateString('en-IN', { month: 'short' })}</i>
                                </span>
                                <span className="jy-text">
                                  <b>{d.title}</b>
                                  <small>{d.kind === 'interview' ? 'Interview' : 'Applications close'}</small>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {showMotion && (
                      <section className="jy-side-card" aria-label="Your applications">
                        <header>
                          <h3>In motion</h3>
                          <Link to="/student/applications">All →</Link>
                        </header>
                        <Motion live={live} />
                      </section>
                    )}
                  </aside>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* What to do now, by stage                                                    */
/* -------------------------------------------------------------------------- */

function Next({
  stage,
  profile,
  sections,
  percent,
  verified,
  roles,
  openCount,
  live,
  due,
  apps,
  onSkillAdded,
}: {
  stage: Stage;
  profile: Profile;
  sections: { key: string; label: string; done: boolean; hint: string }[];
  percent: number;
  verified: boolean;
  roles: JobCard[];
  openCount: number;
  live: MyApplication[];
  due: Due[];
  apps: MyApplication[];
  onSkillAdded: () => void;
}) {
  if (stage === 'profile') {
    const left = sections.filter((s) => !s.done);
    return (
      <Shell
        eyebrow="Next · Finish your profile"
        title={`${left.length} step${left.length === 1 ? '' : 's'} left before recruiters can find you`}
        aside={<Meter percent={percent} />}
      >
        <ul className="jy-todo">
          {left.map((s, i) => (
            <li key={s.key} className={i === 0 ? 'is-first' : ''}>
              <Link to={s.key === 'resume' ? '/student/resume' : '/student/profile'}>
                <span className="jy-todo-dot" aria-hidden="true" />
                <span className="jy-text">
                  <b>{s.label}</b>
                  <small>{s.hint}</small>
                </span>
                <span className="jy-go">{i === 0 ? 'Start' : 'Add'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  if (stage === 'verified') {
    return (
      <Shell
        eyebrow="Next · Your college verifies your record"
        title="Nothing to do here - your placement cell confirms your marks."
        body="Applying opens the moment they do. Meanwhile, look at what is open and get ready for it."
      >
        {roles.length > 0 && <Stack roles={roles} locked />}
        <p className="jy-links">
          <Link to="/student/prepare">Prepare for interviews →</Link>
          <Link to="/student/jobs">Browse jobs →</Link>
        </p>
      </Shell>
    );
  }

  if (stage === 'applied') {
    return (
      <Shell
        eyebrow={`Next · Apply · ${openCount} role${openCount === 1 ? '' : 's'} open to you`}
        title={roles.length ? 'Roles that fit you, best match first' : 'No roles open right now'}
        body={roles.length ? undefined : 'New roles appear here as companies arrive. Your profile is ready for them.'}
      >
        {roles.length > 0 && <Stack roles={roles} />}
        <AskedFor roles={roles} held={profile.skills} onAdded={onSkillAdded} />
      </Shell>
    );
  }

  if (stage === 'rounds') {
    return (
      <Shell
        eyebrow={`Next · Hear back · ${live.length} application${live.length === 1 ? '' : 's'} with companies`}
        title="Companies have to reply in time - you will see it the moment one moves."
      >
        <Motion live={live} />
        {roles.length > 0 && (
          <>
            <p className="jy-mini">While you wait, more roles that fit</p>
            <Stack roles={roles} />
          </>
        )}
      </Shell>
    );
  }

  if (stage === 'offer') {
    const interview = due.find((d) => d.kind === 'interview');
    return (
      <Shell
        eyebrow="Next · Clear your rounds"
        title={interview ? `Next interview: ${dateOf(interview.at)}` : 'You are in the rounds'}
        body={interview ? interview.title : 'Each company shows its rounds and dates on your interviews page.'}
      >
        <Motion live={live} />
        <p className="jy-links">
          <Link to="/student/interviews">Interview details →</Link>
          <Link to="/student/prepare">Prepare →</Link>
        </p>
      </Shell>
    );
  }

  if (stage === 'dayone') {
    const offer = apps.find((a) => a.status === 'OFFERED');
    const accepted = apps.find((a) => a.status === 'ACCEPTED');
    return (
      <Shell
        tone="good"
        eyebrow={offer ? 'Next · Answer your offer' : 'Next · Your first day'}
        title={
          offer
            ? `${offer.companyName} has made you an offer`
            : accepted
              ? `You accepted ${accepted.companyName} - we follow it to your first day`
              : 'Your offer is being followed to your joining date'
        }
        body={offer ? `${offer.title}. Read the whole offer, then accept or decline.` : 'Documents, joining date and any changes are tracked on your applications page.'}
      >
        <p className="jy-links">
          <Link className="jy-cta" to="/student/applications">
            {offer ? 'Review the offer →' : 'Track joining →'}
          </Link>
        </p>
      </Shell>
    );
  }

  return (
    <Shell tone="good" eyebrow="Journey complete" title="You have joined. Congratulations.">
      <p className="jy-links">
        <Link to="/student/alumni">Join the alumni network →</Link>
      </p>
    </Shell>
  );
}

function Shell({
  eyebrow,
  title,
  body,
  aside,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  aside?: ReactNode;
  tone?: 'good';
  children?: ReactNode;
}) {
  return (
    <div className={`jy-card ${tone ? `is-${tone}` : ''}`}>
      <div className="jy-card-head">
        <div>
          <p className="jy-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {body && <p className="jy-body">{body}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Meter({ percent }: { percent: number }) {
  return (
    <div className="jy-meter" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" className="jy-meter-track" />
        <circle cx="32" cy="32" r="27" className="jy-meter-fill" pathLength={100} strokeDasharray={`${percent} 100`} />
      </svg>
      <b>{percent}%</b>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The role stack                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Roles as a small deck: one card on top, the next ones peeking out behind.
 * Skip sends the top card away; Apply opens the role. Arrow keys work when
 * the deck has focus. `locked` is for a record not yet verified: the deck is
 * there to look at, and says why it cannot be applied to yet.
 */
function Stack({ roles, locked = false }: { roles: JobCard[]; locked?: boolean }) {
  const navigate = useNavigate();
  const [top, setTop] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const left = roles.length - top;
  const current = roles[top];

  function skip() {
    if (!current || leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      setTop((n) => n + 1);
      setLeaving(false);
    }, 260);
  }

  function openRole() {
    if (current) navigate(`/student/jobs/${current.id}`);
  }

  if (!current) {
    return (
      <div className="jy-stack-end">
        <p>That is every role on top of the pile.</p>
        <button type="button" className="jy-ghost" onClick={() => setTop(0)}>
          Start again
        </button>
        <Link to="/student/jobs" className="jy-ghost">
          All jobs →
        </Link>
      </div>
    );
  }

  const d = daysTo(current.deadline);

  return (
    <div
      className="jy-stack"
      tabIndex={0}
      aria-label={`Role ${top + 1} of ${roles.length}. Left arrow to skip, right arrow to open.`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') skip();
        if (e.key === 'ArrowRight') openRole();
      }}
    >
      <div className="jy-deck">
        {/* The ones behind, for depth. */}
        {left > 2 && <span className="jy-ghostcard is-2" aria-hidden="true" />}
        {left > 1 && <span className="jy-ghostcard is-1" aria-hidden="true" />}

        <article key={current.id} className={`jy-role ${leaving ? 'is-leaving' : ''}`}>
          <div className="jy-role-top">
            <span className="jy-logo is-big" aria-hidden="true">
              {current.companyName.slice(0, 1)}
            </span>
            <span className="jy-text">
              <b>{current.title}</b>
              <small>{[current.companyName, current.location].filter(Boolean).join(' · ')}</small>
            </span>
            <span
              className={`jy-match ${current.match.score >= 75 ? 'is-high' : ''}`}
              style={{ '--p': `${current.match.score}%` } as CSSProperties}
            >
              <i>{current.match.score}%</i>
            </span>
          </div>

          <dl className="jy-role-facts">
            {pay(current) && (
              <div>
                <dt>Package</dt>
                <dd>{pay(current)}</dd>
              </div>
            )}
            <div>
              <dt>Closes</dt>
              <dd className={d <= 3 ? 'is-soon' : ''}>{d <= 0 ? 'Today' : `In ${d} day${d === 1 ? '' : 's'}`}</dd>
            </div>
            <div>
              <dt>Rounds</dt>
              <dd>{current.roundCount || '—'}</dd>
            </div>
          </dl>

          {current.skills.length > 0 && (
            <p className="jy-role-skills">
              {current.skills.slice(0, 5).map((s) => (
                <span key={s} className={current.match.missing.includes(s) ? 'is-missing' : 'is-have'}>
                  {s}
                </span>
              ))}
            </p>
          )}
        </article>
      </div>

      <div className="jy-stack-actions">
        <button type="button" className="jy-act is-skip" onClick={skip} aria-label="Skip this role">
          ✕
        </button>
        <span className="jy-count">
          {top + 1} / {roles.length}
        </span>
        {locked ? (
          <button type="button" className="jy-act is-open" onClick={openRole}>
            View
          </button>
        ) : (
          <button type="button" className="jy-act is-apply" onClick={openRole}>
            Apply →
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The roles that open up once the profile is finished (or the record is
 * verified): a few of them, shown but not yet actionable, so finishing has a
 * visible reward. With nothing open yet, it says what happens instead.
 */
function Waiting({ roles, total, stage }: { roles: JobCard[]; total: number; stage: 'profile' | 'verified' }) {
  const why = stage === 'profile' ? 'Finish your profile to apply' : 'Opens once your college verifies you';
  return (
    <section className="jy-wait" aria-label="Roles waiting for you">
      <header>
        <h3>
          Waiting for you
          {total > 0 && <span className="jy-wait-n">{total} open</span>}
        </h3>
        {total > 0 && <Link to="/student/jobs">See all →</Link>}
      </header>
      {roles.length === 0 ? (
        <p className="jy-wait-none">
          No roles are open at your college yet. When companies arrive, the ones that match your course
          and marks appear here first.
        </p>
      ) : (
        <ul>
          {roles.map((j) => (
            <li key={j.id}>
              <Link to={`/student/jobs/${j.id}`}>
                <span className="jy-wait-top">
                  <span className="jy-logo" aria-hidden="true">
                    {j.companyName.slice(0, 1)}
                  </span>
                  <span className={`jy-wait-match ${j.match.score >= 75 ? 'is-high' : ''}`}>{j.match.score}%</span>
                </span>
                <b>{j.title}</b>
                <small>{[j.companyName, pay(j)].filter(Boolean).join(' · ')}</small>
                <span className="jy-wait-lock">🔒 {why}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Applications with a company, compact. */
function Motion({ live }: { live: MyApplication[] }) {
  if (live.length === 0) return null;
  return (
    <ul className="jy-motion-list">
      {live.slice(0, 4).map((a) => (
        <li key={a.id}>
          <Link to="/student/applications">
            <span className="jy-logo" aria-hidden="true">
              {a.companyName.slice(0, 1)}
            </span>
            <span className="jy-text">
              <b>{a.title}</b>
              <small>
                {a.companyName}
                {a.currentRound ? ` · Round ${a.currentRound.order}: ${a.currentRound.name}` : ''}
              </small>
            </span>
            <span className={`jy-pill is-${a.status.toLowerCase()}`}>{STATUS[a.status] ?? a.status}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Skills the roles keep asking for that the student has not listed. Worded
 * as a question: a skill added because a number went up is a lie the first
 * interview finds.
 */
function AskedFor({ roles, held, onAdded }: { roles: JobCard[]; held: string[]; onAdded: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const asked = useMemo(() => {
    const count = new Map<string, number>();
    for (const j of roles) for (const s of j.match.missing) count.set(s, (count.get(s) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
  }, [roles]);

  if (asked.length === 0) return null;

  async function add(name: string) {
    setBusy(name);
    setError(null);
    try {
      await candidateApi.saveSkills([...held, name]);
      setAdded((s) => new Set(s).add(name));
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not save.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="jy-asked">
      <p className="jy-mini">Roles keep asking for these. Already know one? Add it.</p>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="jy-asked-list">
        {asked.map((s) => (
          <button
            key={s}
            type="button"
            className={added.has(s) ? 'is-added' : ''}
            disabled={busy !== null || added.has(s)}
            onClick={() => void add(s)}
          >
            {added.has(s) ? '✓' : '+'} {s}
          </button>
        ))}
      </div>
    </div>
  );
}
