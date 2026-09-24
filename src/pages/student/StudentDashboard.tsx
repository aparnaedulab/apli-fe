import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import Apli, { type ApliSays } from './Apli';
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
 * A dashboard earns its place only by doing what the pages under it cannot.
 * Summarising them is not that: a panel of live applications beside a panel
 * of open roles is a table of contents, and a student who has used the portal
 * twice stops reading it.
 *
 * So this page keeps only what is true of everything at once:
 *
 *   This week   - interviews, closing dates and an offer waiting on them, in
 *                 one dated list. Every other screen holds one kind of these;
 *                 nothing but the overview can put them in time order.
 *   How it works- the five stages with their own figures in them, each one
 *                 opening in place to show the actual roles behind the number.
 *   Asked for   - the skills the open roles keep wanting, counted across all
 *                 of them. No single job page can see this, and it is the one
 *                 thing here that changes what they can reach.
 *
 * It is also built around what the waiting does to somebody. A placement
 * portal judges a person repeatedly, by strangers, on a timetable they do not
 * control, and most of what it has to say is a refusal. So nothing here ranks
 * them against their cohort, and the stages are named as a process running
 * rather than as a verdict being passed.
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

/** Two letters for the corner, from whatever name we were given. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** "Today", "Tomorrow", or a short date - the form the answer is needed in. */
function dayOf(at: number): string {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const d = Math.floor((at - midnight.getTime()) / 86_400_000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return new Date(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/**
 * A number that counts up to its figure the first time it arrives.
 *
 * Not decoration: a figure that moves is one a person reads. It counts once,
 * on the way in - a number that re-animates on every render is a distraction
 * rather than an arrival - and jumps straight to the figure for anybody who
 * has asked for less motion.
 */
function useCountUp(to: number, ms = 750): number {
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

  const sent = apps?.length ?? 0;
  const shortlisted = useMemo(
    () => (apps ?? []).filter((a) => a.status === 'SHORTLISTED'),
    [apps],
  );
  const inRounds = useMemo(() => (apps ?? []).filter((a) => a.status === 'IN_ROUND'), [apps]);
  const offers = useMemo(
    () => (apps ?? []).filter((a) => ['OFFERED', 'ACCEPTED', 'HIRED'].includes(a.status)),
    [apps],
  );

  /**
   * Everything with a clock on it, in one list.
   *
   * Interviews live on one page, closing dates on another and an unanswered
   * offer on a third. Nothing but the overview can put them in time order,
   * and time order is the only order that tells a student what to do today.
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
      // student can be holding, so it sits at the top of the list.
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

    return out.sort((a, b) => a.at - b.at).slice(0, 5);
  }, [apps, open]);

  /**
   * What the open roles keep asking for and this student has not listed.
   *
   * Counted across every role at once, which no single job page can do. It is
   * the one thing on this screen that changes what they can reach rather than
   * reporting on it.
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
      .slice(0, 6)
      .map(([name, n]) => ({ name, n }));
  }, [open]);

  function whatApliSays(): ApliSays {
    if (!verified) {
      return {
        mood: 'think',
        text: 'Your college has not verified your record yet, so applying is closed for now. None of the work below is wasted — have it finished for the day they unlock it.',
        action: { to: '/student/profile', label: 'Get it ready' },
      };
    }
    if (offers.some((a) => a.status === 'OFFERED')) {
      return {
        mood: 'cheer',
        text: 'You have an offer waiting for an answer. Take the time you need, but do not leave them without one.',
        action: { to: '/student/applications', label: 'Answer it' },
      };
    }
    if (percent < 60) {
      return {
        mood: 'nudge',
        text: `Your profile is ${percent}% done, and the missing parts are the ones a recruiter reads first. Ten minutes changes what you can reach.`,
        action: {
          to: '/student/profile',
          label: nextUp ? `Add your ${nextUp.label.toLowerCase()}` : 'Finish it',
        },
      };
    }
    if (live.length > 0) {
      return {
        mood: 'cheer',
        text: `${live.length} application${live.length === 1 ? ' is' : 's are'} with a company now. That part is out of your hands — the useful thing is to keep going while you wait.`,
        action: { to: '/student/applications', label: 'See where they are' },
      };
    }
    if (open.length > 0) {
      return {
        mood: 'cheer',
        text: `${open.length} role${open.length === 1 ? '' : 's'} are open to you, and every one already matches your course, your marks and your batch.`,
        action: { to: '/student/jobs', label: 'Have a look' },
      };
    }
    return {
      mood: 'hello',
      text: 'Nothing is open this minute. That changes as companies arrive, and how ready your profile is decides how much of it you can reach.',
      action: { to: '/student/profile', label: 'Keep it sharp' },
    };
  }

  const loading = !profile && error === null;

  return (
    <StudentLayout>
      <NoticeBoard />
      <StudentDrives />
      {/*
        Who they are, before anything is asked of them. Every fact here is one
        a recruiter filters on, so a student can see what is read about them.
      */}
      {profile && (
        <header className="ov-me">
          <span className="ov-face" aria-hidden="true">
            {initialsOf(profile.fullName)}
          </span>

          <div className="ov-who">
            <h1>{t('dash.hello', { name: profile.fullName.split(' ')[0]! })}</h1>
            {profile.headline && <p className="ov-headline">{profile.headline}</p>}
            <p className="ov-where">
              {profile.batch
                ? [
                    profile.batch.college,
                    profile.batch.course,
                    profile.batch.name,
                    `Class of ${profile.batch.graduationYear}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : t('dash.noBatch')}
            </p>

            <p className="ov-seal">
              <span className={`ov-pill ${verified ? 'is-on' : ''}`}>
                {verified ? 'Verified by your college' : 'Not verified yet'}
              </span>
              {profile.cgpa && <span className="ov-fact">CGPA {profile.cgpa}</span>}
              <span className="ov-fact">
                {profile.skills.length} skill{profile.skills.length === 1 ? '' : 's'}
              </span>
              <Link className="ov-fact is-link" to="/student/resume">
                {profile.resumeUrl ? 'Resume on file' : 'No resume yet'}
              </Link>
            </p>
          </div>
        </header>
      )}

      {!profile && (
        <header className="page-head">
          <div>
            <p className="eyebrow">{t('common.student')}</p>
            <h1>{t('dash.overview')}</h1>
          </div>
        </header>
      )}

      {error !== null && <p className="alert alert-error">{error || t('dash.loadError')}</p>}

      {loading && (
        <>
          <div className="sk sk-apli" />
          <div className="sk sk-split" />
        </>
      )}

      {profile && (
        <>
          <Apli says={whatApliSays()} name={profile.fullName.split(' ')[0]} />

          <Week due={due} />

          <Path
            percent={percent}
            nextUp={nextUp?.label ?? null}
            openRoles={open}
            live={live}
            shortlisted={shortlisted}
            inRounds={inRounds}
            offers={offers}
          />

          {asked.length > 0 && (
            <SkillGap
              asked={asked}
              held={profile.skills}
              total={open.length}
              onAdded={load}
            />
          )}
        </>
      )}
    </StudentLayout>
  );
}

/**
 * Everything with a clock on it, in time order.
 *
 * The one list the portal can only build here: an interview lives on one
 * page, a closing date on another, an unanswered offer on a third.
 */
function Week({ due }: { due: Due[] }) {
  if (due.length === 0) {
    return (
      <section className="ov-week is-quiet">
        <p className="ov-week-tag">This week</p>
        <p className="ov-week-none">
          Nothing dated. That is not a setback — it is the part that has not started yet.
        </p>
      </section>
    );
  }

  return (
    <section className="ov-week">
      <p className="ov-week-tag">This week</p>
      <ul>
        {due.map((d) => (
          <li key={d.key} className={`is-${d.kind}`}>
            <Link to={d.to}>
              <span className="ov-due-when">
                {d.kind === 'offer' ? (
                  <b>Now</b>
                ) : (
                  <>
                    <b>{dayOf(d.at)}</b>
                    {d.kind === 'interview' && <small>{timeOf(d.at)}</small>}
                    {d.kind === 'closes' && (
                      <small>
                        {Math.max(0, Math.ceil((d.at - Date.now()) / 86_400_000))}d left
                      </small>
                    )}
                  </>
                )}
              </span>
              <span className="ov-due-what">
                <b>{d.title}</b>
                <small>{d.sub}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The portal, as the five things that actually happen, with the student's own
 * numbers standing in each - and each one opening in place.
 *
 * Drawn rather than written because a student reading "we help you get
 * placed" learns nothing. Opening a stage shows the roles behind its number,
 * which is what turns the strip from a picture into somewhere to work.
 */
function Path({
  percent,
  nextUp,
  openRoles,
  live,
  shortlisted,
  inRounds,
  offers,
}: {
  percent: number;
  nextUp: string | null;
  openRoles: JobCard[];
  live: MyApplication[];
  shortlisted: MyApplication[];
  inRounds: MyApplication[];
  offers: MyApplication[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  const stages = [
    { key: 'ready', label: 'Get ready', n: percent, suffix: '%', hint: 'Your record' },
    { key: 'apply', label: 'Apply', n: openRoles.length, hint: 'Open to you' },
    { key: 'sent', label: 'Sent', n: live.length, hint: 'With a company' },
    {
      key: 'rounds',
      label: 'Rounds',
      n: shortlisted.length + inRounds.length,
      hint: 'Shortlisted, called in',
    },
    { key: 'offer', label: 'Offer', n: offers.length, hint: 'Yours to answer' },
  ] as const;

  /* The furthest stage with anything in it - the one worth lighting. */
  const at = stages.reduce((best, st, i) => (st.n > 0 ? i : best), 0);
  const shown = stages.find((st) => st.key === open);

  return (
    <section className="ov-path">
      <p className="ov-path-tag">How this works</p>

      <ol>
        {stages.map((st, i) => (
          <li
            key={st.key}
            className={`${i === at ? 'is-here' : ''} ${i < at ? 'is-done' : ''} ${
              open === st.key ? 'is-open' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(open === st.key ? null : st.key)}
              aria-expanded={open === st.key}
            >
              <b>
                <Counted n={st.n} />
                {'suffix' in st ? st.suffix : ''}
              </b>
              <span>{st.label}</span>
              <small>{st.hint}</small>
            </button>
          </li>
        ))}
      </ol>

      {/* What is actually behind the number, without leaving the page. */}
      {shown && (
        <div className="ov-drawer">
          {shown.key === 'ready' && (
            <p className="ov-drawer-line">
              {percent === 100
                ? 'Everything a recruiter filters on is on record.'
                : `${nextUp ?? 'Some details'} is the next thing missing.`}{' '}
              <Link to="/student/profile">Open your profile →</Link>
            </p>
          )}

          {shown.key === 'apply' &&
            (openRoles.length === 0 ? (
              <p className="ov-drawer-line">
                Nothing open this minute. <Link to="/student/jobs">See the jobs page →</Link>
              </p>
            ) : (
              <ul className="ov-drawer-list">
                {openRoles.slice(0, 4).map((j) => (
                  <li key={j.id}>
                    <Link to={`/student/jobs/${j.id}`}>
                      <b>{j.title}</b>
                      <small>
                        {j.companyName} · {j.match.score}% match ·{' '}
                        {Math.max(0, daysTo(j.deadline))} days left
                      </small>
                    </Link>
                  </li>
                ))}
                {openRoles.length > 4 && (
                  <li className="ov-drawer-more">
                    <Link to="/student/jobs">and {openRoles.length - 4} more →</Link>
                  </li>
                )}
              </ul>
            ))}

          {['sent', 'rounds', 'offer'].includes(shown.key) && (
            <Apps
              list={
                shown.key === 'sent'
                  ? live
                  : shown.key === 'rounds'
                    ? [...shortlisted, ...inRounds]
                    : offers
              }
              empty={
                shown.key === 'sent'
                  ? 'Nothing with a company yet.'
                  : shown.key === 'rounds'
                    ? 'No rounds yet. A company shortlists first, then calls you in.'
                    : 'No offers yet.'
              }
            />
          )}
        </div>
      )}
    </section>
  );
}

/** Applications behind one stage of the path. */
function Apps({ list, empty }: { list: MyApplication[]; empty: string }) {
  if (list.length === 0) {
    return (
      <p className="ov-drawer-line">
        {empty} <Link to="/student/jobs">Find a role →</Link>
      </p>
    );
  }
  return (
    <ul className="ov-drawer-list">
      {list.slice(0, 4).map((a) => (
        <li key={a.id}>
          <Link to="/student/applications">
            <b>{a.title}</b>
            <small>
              {a.companyName} · {WHERE[a.status] ?? a.status}
            </small>
          </Link>
        </li>
      ))}
      {list.length > 4 && (
        <li className="ov-drawer-more">
          <Link to="/student/applications">and {list.length - 4} more →</Link>
        </li>
      )}
    </ul>
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
function SkillGap({
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
  const [error, setError] = useState<string | null>(null);

  async function add(name: string) {
    setBusy(name);
    setError(null);
    try {
      await candidateApi.saveSkills([...held, name]);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not save.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ov-gap">
      <p className="ov-gap-tag">What the roles keep asking for</p>
      <p className="ov-gap-lede">
        Counted across all {total} role{total === 1 ? '' : 's'} open to you. If you already know one,
        add it — it changes what you match. If you do not, it is a straight answer about what to
        learn next.
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      <ul>
        {asked.map((s) => (
          <li key={s.name}>
            <span className="ov-gap-name">{s.name}</span>
            <span className="ov-gap-n">
              {s.n} role{s.n === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="ov-gap-add"
              disabled={busy !== null}
              onClick={() => void add(s.name)}
            >
              {busy === s.name ? 'Adding…' : 'I know this'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A figure that counts up on the way in. */
function Counted({ n }: { n: number }) {
  return <>{useCountUp(n)}</>;
}
