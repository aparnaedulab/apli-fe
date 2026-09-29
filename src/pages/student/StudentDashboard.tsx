import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApliFace, type Mood } from './Apli';
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
import './Dashboard.css';

/**
 * The first screen a student sees.
 *
 * Not a dashboard. A dashboard is a wall of panels that each summarise a
 * page under it, and a student who has used the portal twice stops reading
 * it - they know what is on the jobs page, they came here to find out
 * whether anything has changed.
 *
 * So this is a home screen. Three movements, in the order somebody would
 * actually ask them:
 *
 *   Your name, and one line       - said plainly, in type big enough that it
 *                                   is the answer rather than a header.
 *   Anything with a clock on it   - a deck of cards you push sideways. An
 *                                   interview lives on one page, a closing
 *                                   date on another, an unanswered offer on
 *                                   a third; nothing but this screen can put
 *                                   the three in time order, and time order
 *                                   is the only order that says what to do
 *                                   today.
 *   Everything else, as tiles     - different sizes, different weights, one
 *                                   of them dark. A grid where every tile is
 *                                   the same white rectangle is read as a
 *                                   form; a grid with a hierarchy is read.
 *
 * It is built around what the waiting does to somebody. A placement portal
 * judges a person repeatedly, by strangers, on a timetable they do not
 * control, and most of what it has to say is a refusal. So nothing here
 * ranks them against their cohort, and the stages are named as a process
 * running rather than as a verdict being passed.
 */

/** The statuses that still have somewhere to go. */
const LIVE = new Set([
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'IN_ROUND',
  'WAITLISTED',
  'OFFERED',
]);

/** Said as a stage in a process, never as a judgement on the person. */
const WHERE: Record<string, string> = {
  APPLIED: 'Waiting to be opened',
  UNDER_REVIEW: 'Being read',
  SHORTLISTED: 'Shortlisted',
  IN_ROUND: 'In a round',
  WAITLISTED: 'Held on a waitlist',
  OFFERED: 'You have an offer',
  ACCEPTED: 'You accepted',
  HIRED: 'Hired',
  REJECTED: 'Not taken forward',
  DECLINED: 'You declined',
  WITHDRAWN: 'You withdrew',
};

const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** "Today", "Tomorrow", or a short date - the form the answer is needed in. */
function dayOf(at: number): string {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const d = Math.floor((at - midnight.getTime()) / 86_400_000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return new Date(at).toLocaleDateString('en-IN', { weekday: 'long' });
}

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

const dateOf = (at: number) =>
  new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** "Good morning" and the rest, which is the one thing a clock is good for. */
function partOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * A number that counts up to its figure the first time it arrives.
 *
 * Not decoration: a figure that moves is one a person reads. It counts once,
 * on the way in - a number that re-animates on every render is a distraction
 * rather than an arrival - and jumps straight to the figure for anybody who
 * has asked for less motion.
 */
function useCountUp(to: number, ms = 800): number {
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || to === 0) {
      setN(to);
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(to);
      done.current = true;
      return;
    }

    let raf = 0;
    const from = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - from) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);

  return n;
}

/** One dated thing, whatever kind it is. */
interface Due {
  key: string;
  at: number;
  kind: 'interview' | 'offer' | 'closes';
  title: string;
  sub: string;
  to: string;
}

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
  const nextUp = sections.find((s) => !s.done);

  const open = useMemo(() => (jobs ?? []).filter((j) => !j.applicationStatus), [jobs]);
  const live = useMemo(() => (apps ?? []).filter((a) => LIVE.has(a.status)), [apps]);
  const shortlisted = useMemo(
    () => (apps ?? []).filter((a) => a.status === 'SHORTLISTED'),
    [apps],
  );
  const inRounds = useMemo(() => (apps ?? []).filter((a) => a.status === 'IN_ROUND'), [apps]);
  const offers = useMemo(
    () => (apps ?? []).filter((a) => ['OFFERED', 'ACCEPTED', 'HIRED'].includes(a.status)),
    [apps],
  );

  /** The best of the open roles first, since only four of them are shown. */
  const best = useMemo(
    () => [...open].sort((a, b) => b.match.score - a.match.score).slice(0, 4),
    [open],
  );

  /**
   * Everything with a clock on it, in one list.
   *
   * Interviews live on one page, closing dates on another and an unanswered
   * offer on a third. Nothing but this screen can put them in time order.
   */
  const due = useMemo<Due[]>(() => {
    const out: Due[] = [];
    const now = Date.now();

    for (const a of apps ?? []) {
      if (a.status === 'IN_ROUND') {
        const round = a.rounds.find((r) => r.id === a.currentRound?.id);
        if (round?.scheduledAt) {
          const at = new Date(round.scheduledAt).getTime();
          if (at > now) {
            out.push({
              key: `iv-${a.id}`,
              at,
              kind: 'interview',
              title: round.name,
              sub: `${a.companyName} · ${round.isOnline ? 'Online' : 'In person'}`,
              to: '/student/interviews',
            });
          }
        }
      }
      // An offer has no clock of its own, but it is the most urgent thing a
      // student can be holding, so it sits at the head of the deck.
      if (a.status === 'OFFERED') {
        out.push({
          key: `of-${a.id}`,
          at: 0,
          kind: 'offer',
          title: 'An offer is waiting on you',
          sub: `${a.title} · ${a.companyName}`,
          to: '/student/applications',
        });
      }
    }

    for (const j of open) {
      const d = daysTo(j.deadline);
      if (d >= 0 && d <= 7) {
        out.push({
          key: `cl-${j.id}`,
          at: new Date(j.deadline).getTime(),
          kind: 'closes',
          title: j.title,
          sub: `${j.companyName} · applications close`,
          to: `/student/jobs/${j.id}`,
        });
      }
    }

    return out.sort((a, b) => a.at - b.at).slice(0, 8);
  }, [apps, open]);

  /**
   * What the open roles keep asking for and this student has not listed.
   *
   * Counted across every role at once, which no single job page can do. It
   * is the one thing on this screen that changes what they can reach rather
   * than reporting on it.
   */
  const asked = useMemo(() => {
    const count = new Map<string, number>();
    for (const j of open) {
      for (const skill of j.match.missing) {
        count.set(skill, (count.get(skill) ?? 0) + 1);
      }
    }
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, n]) => ({ name, n }));
  }, [open]);

  /** One line under the name. The whole state of play, said once. */
  function theLine(): { mood: Mood; text: string } {
    if (!verified) {
      return {
        mood: 'think',
        text: 'Your college has not verified your record yet, so applying is closed. None of the work below is wasted — have it finished for the day they unlock it.',
      };
    }
    if (offers.some((a) => a.status === 'OFFERED')) {
      return { mood: 'proud', text: 'You have an offer waiting for an answer. That is the only thing on this page that matters today.' };
    }
    if (percent < 60) {
      return {
        mood: 'nudge',
        text: `Your profile is ${percent}% done, and the missing parts are the ones a recruiter reads first. Ten minutes changes what you can reach.`,
      };
    }
    if (live.length > 0 && open.length > 0) {
      return {
        mood: 'cheer',
        text: `${live.length} application${live.length === 1 ? ' is' : 's are'} with a company, and ${open.length} more role${open.length === 1 ? ' is' : 's are'} open to you.`,
      };
    }
    if (live.length > 0) {
      return {
        mood: 'cheer',
        text: `${live.length} application${live.length === 1 ? ' is' : 's are'} with a company now. That part is out of your hands — keep going while you wait.`,
      };
    }
    if (open.length > 0) {
      return {
        mood: 'cheer',
        text: `${open.length} role${open.length === 1 ? '' : 's'} open to you, every one already matching your course, your marks and your batch.`,
      };
    }
    return {
      mood: 'hello',
      text: 'Nothing is open this minute. That changes as companies arrive, and how ready your profile is decides how much of it you can reach.',
    };
  }

  const loading = !profile && error === null;

  return (
    <StudentLayout>
      <NoticeBoard />
      <StudentDrives />

      {error !== null && <p className="alert alert-error">{error || t('dash.loadError')}</p>}

      {loading && (
        <>
          <div className="sk ov-sk-hail" />
          <div className="ov-sk-rail">
            <div className="sk" />
            <div className="sk" />
            <div className="sk" />
          </div>
          <div className="ov-sk-bento">
            <div className="sk" />
            <div className="sk" />
          </div>
        </>
      )}

      {profile && (
        <>
          <Hail profile={profile} verified={verified} says={theLine()} />

          <Deck due={due} />

          <div className="ov-bento">
            <Ready percent={percent} nextUp={nextUp?.label ?? null} verified={verified} />

            <Roles roles={best} total={open.length} />

            <Journey
              percent={percent}
              openCount={open.length}
              live={live.length}
              rounds={shortlisted.length + inRounds.length}
              offers={offers.length}
            />

            <Sent live={live} />

            {asked.length > 0 && (
              <Skills asked={asked} held={profile.skills} total={open.length} onAdded={() => {
                load();
                refreshMe();
              }} />
            )}
          </div>
        </>
      )}
    </StudentLayout>
  );
}

/* ==========================================================================
   Their name, and one line
   ========================================================================== */

/**
 * Bare on the canvas, not in a card.
 *
 * The first thing on the screen should be the answer, not a container for
 * the answer. A heading inside a bordered panel is a document; a name in
 * 46px type with one sentence under it is somebody being spoken to.
 */
function Hail({
  profile,
  verified,
  says,
}: {
  profile: Profile;
  verified: boolean;
  says: { mood: Mood; text: string };
}) {
  const name = profile.fullName.split(' ')[0] ?? '';

  return (
    <header className="ov-hail">
      <div className="ov-hail-said">
        <p className="ov-hail-when">{partOfDay()}</p>
        <h1>
          {name}
          <span aria-hidden="true">.</span>
        </h1>
        <p className="ov-hail-line">{says.text}</p>

        <p className="ov-hail-facts">
          <span className={`ov-chip ${verified ? 'is-on' : ''}`}>
            {verified ? 'Verified by your college' : 'Not verified yet'}
          </span>
          {profile.batch && (
            <span className="ov-chip">
              {profile.batch.course} · {profile.batch.graduationYear}
            </span>
          )}
          {profile.cgpa && <span className="ov-chip">CGPA {profile.cgpa}</span>}
          <Link className="ov-chip is-link" to="/student/resume">
            {profile.resumeUrl ? 'Resume on file' : 'Add a resume'}
          </Link>
        </p>
      </div>

      {/* Apli, at the size a character deserves on the one screen that is
          about the person rather than about a role. */}
      <div className="ov-hail-apli" aria-hidden="true">
        <ApliFace mood={says.mood} size={132} idle />
      </div>
    </header>
  );
}

/* ==========================================================================
   Anything with a clock on it
   ========================================================================== */

/**
 * A deck you push sideways, not a list you scroll past.
 *
 * These are the three or four facts that decide what somebody does today, so
 * they get the whole width, real colour and type big enough to read from
 * across a lecture hall. A row of table rows would say the same thing and be
 * skipped.
 */
function Deck({ due }: { due: Due[] }) {
  if (due.length === 0) {
    return (
      <section className="ov-deck is-quiet">
        <p className="ov-tag">On your clock</p>
        <p className="ov-deck-none">
          Nothing dated this week. That is not a setback — it is the part that has not started yet.
        </p>
      </section>
    );
  }

  return (
    <section className="ov-deck">
      <p className="ov-tag">
        On your clock
        <b>{due.length}</b>
      </p>

      <div className="rail">
        {due.map((d) => (
          <Link key={d.key} to={d.to} className={`ov-due is-${d.kind}`}>
            <span className="ov-due-kind">
              {d.kind === 'offer' ? 'Offer' : d.kind === 'interview' ? 'Interview' : 'Closing'}
            </span>

            <span className="ov-due-when">
              {d.kind === 'offer' ? (
                'Waiting on you'
              ) : (
                <>
                  {dayOf(d.at)}
                  <i>
                    {d.kind === 'interview'
                      ? timeOf(d.at)
                      : `${Math.max(0, Math.ceil((d.at - Date.now()) / 86_400_000))} days left`}
                  </i>
                </>
              )}
            </span>

            <span className="ov-due-what">{d.title}</span>
            <span className="ov-due-sub">{d.sub}</span>
            {d.kind !== 'offer' && <span className="ov-due-date">{dateOf(d.at)}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ==========================================================================
   The bento
   ========================================================================== */

/**
 * How ready their own record is - the one dark tile on the screen.
 *
 * Dark on purpose. It is the only number here a student can move by
 * themselves this afternoon, and one tile that does not look like the others
 * is worth more than any amount of colour spread evenly across all of them.
 */
function Ready({
  percent,
  nextUp,
  verified,
}: {
  percent: number;
  nextUp: string | null;
  verified: boolean;
}) {
  const n = useCountUp(percent);
  const r = 46;
  const c = 2 * Math.PI * r;

  return (
    <Link className="bx bx-ready" to="/student/profile">
      <p className="ov-tag is-inverse">Your record</p>

      <div className="ov-ready-ring">
        <svg viewBox="0 0 110 110" aria-hidden="true">
          <defs>
            {/* The stops are coloured from CSS: a `var()` in a presentation
                attribute is not resolved, so the ring came out black. */}
            <linearGradient id="ov-ready-grad" x1="0" y1="0" x2="1" y2="1">
              <stop className="ov-ring-a" offset="0%" />
              <stop className="ov-ring-b" offset="100%" />
            </linearGradient>
          </defs>
          <circle className="ov-ready-track" cx="55" cy="55" r={r} />
          <circle
            className="ov-ready-value"
            cx="55"
            cy="55"
            r={r}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - n / 100)}
          />
        </svg>
        <b>
          {n}
          <i>%</i>
        </b>
      </div>

      <p className="ov-ready-say">
        {percent === 100
          ? verified
            ? 'Complete, and verified. Every filter a recruiter sets, you clear on paper.'
            : 'Complete. Your college verifies it next — that is what unlocks applying.'
          : `Next up: ${nextUp ?? 'a few details'}.`}
      </p>
      <span className="ov-go">{percent === 100 ? 'Look it over' : 'Finish it'}</span>
    </Link>
  );
}

/** The roles that fit best, as a short list rather than a page of cards. */
function Roles({ roles, total }: { roles: JobCard[]; total: number }) {
  return (
    <section className="bx bx-roles">
      <p className="ov-tag">
        Open to you
        {total > 0 && <b>{total}</b>}
      </p>

      {roles.length === 0 ? (
        <p className="ov-none">
          Nothing open this minute. It changes as companies arrive — your profile decides how much
          of it you can reach.
        </p>
      ) : (
        <ul className="ov-roles">
          {roles.map((j) => (
            <li key={j.id}>
              <Link to={`/student/jobs/${j.id}`}>
                <span
                  className="ov-role-match"
                  style={{ ['--p' as string]: `${j.match.score}%` }}
                  aria-label={`${j.match.score}% match`}
                >
                  <i>{j.match.score}</i>
                </span>
                <span className="ov-role-who">
                  <b>{j.title}</b>
                  <small>{j.companyName}</small>
                </span>
                <span className="ov-role-left">
                  {Math.max(0, daysTo(j.deadline))}d
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link className="ov-go" to="/student/jobs">
        {total > roles.length ? `See all ${total}` : 'Open the jobs page'}
      </Link>
    </section>
  );
}

/**
 * The five things that actually happen, with their own numbers in them.
 *
 * Drawn rather than written, because a student reading "we help you get
 * placed" learns nothing. Named as a process running, never as a verdict:
 * "Sent" and "Rounds", not "Success rate".
 */
function Journey({
  percent,
  openCount,
  live,
  rounds,
  offers,
}: {
  percent: number;
  openCount: number;
  live: number;
  rounds: number;
  offers: number;
}) {
  const stages = [
    { key: 'ready', label: 'Ready', n: percent, suffix: '%', to: '/student/profile' },
    { key: 'apply', label: 'Open', n: openCount, to: '/student/jobs' },
    { key: 'sent', label: 'Sent', n: live, to: '/student/applications' },
    { key: 'rounds', label: 'Rounds', n: rounds, to: '/student/interviews' },
    { key: 'offer', label: 'Offers', n: offers, to: '/student/applications' },
  ] as const;

  /* The furthest stage with anything in it - the one worth lighting. */
  const at = stages.reduce((best, st, i) => (st.n > 0 ? i : best), 0);

  return (
    <section className="bx bx-journey">
      <p className="ov-tag">Where you are</p>
      <ol>
        {stages.map((st, i) => (
          <li
            key={st.key}
            className={`${i === at ? 'is-here' : ''} ${i < at ? 'is-done' : ''}`}
          >
            <Link to={st.to}>
              <b>
                <Counted n={st.n} />
                {'suffix' in st ? st.suffix : ''}
              </b>
              <span>{st.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The ones already with a company, and where each has got to. */
function Sent({ live }: { live: MyApplication[] }) {
  return (
    <section className="bx bx-sent">
      <p className="ov-tag">
        With a company
        {live.length > 0 && <b>{live.length}</b>}
      </p>

      {live.length === 0 ? (
        <p className="ov-none">
          Nothing sent yet. Every role you can see is one you are already eligible for.
        </p>
      ) : (
        <ul className="ov-sent">
          {live.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link to="/student/applications">
                <span className={`ov-dot is-${a.status.toLowerCase()}`} aria-hidden="true" />
                <span className="ov-sent-who">
                  <b>{a.title}</b>
                  <small>{a.companyName}</small>
                </span>
                <span className="ov-sent-at">{WHERE[a.status] ?? a.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link className="ov-go" to="/student/applications">
        {live.length > 4 ? `All ${live.length}` : 'Track them'}
      </Link>
    </section>
  );
}

/**
 * What the open roles keep asking for.
 *
 * Counted across every role at once, which no single job page can do - and
 * the only thing on this screen that changes what a student can reach rather
 * than reporting on it.
 *
 * Worded as a question, never as a button that "unlocks" anything. A skill
 * added because a number went up is a lie told to a recruiter, and the first
 * interview finds it.
 */
function Skills({
  asked,
  held,
  total,
  onAdded,
}: {
  asked: { name: string; n: number }[];
  held: string[];
  total: number;
  onAdded: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function add(name: string) {
    setBusy(name);
    setError(null);
    try {
      await candidateApi.saveSkills([...held, name]);
      setGone((s) => new Set(s).add(name));
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not save.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bx bx-skills">
      <p className="ov-tag">Asked for most</p>
      <p className="ov-skills-lede">
        Counted across all {total} role{total === 1 ? '' : 's'} open to you. Tap one you already
        know and it changes what you match. If you do not know it, that is a straight answer about
        what to learn next.
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="ov-skills">
        {asked.map((s) => (
          <button
            key={s.name}
            type="button"
            className={`ov-skill ${gone.has(s.name) ? 'is-added' : ''}`}
            disabled={busy !== null || gone.has(s.name)}
            onClick={() => void add(s.name)}
            title={`Asked for by ${s.n} role${s.n === 1 ? '' : 's'}`}
          >
            <span className="ov-skill-name">{s.name}</span>
            <span className="ov-skill-n">{gone.has(s.name) ? 'added' : s.n}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** A figure that counts up on the way in. */
function Counted({ n }: { n: number }) {
  return <>{useCountUp(n)}</>;
}
