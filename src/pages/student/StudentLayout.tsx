import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import ApliBubble, { ApliFace } from './Apli';
import NotificationBell from '../../components/NotificationBell';
import { iconFor, GridIcon, CloseIcon, SignOutIcon } from './navIcons';
import { forgetMe, initialsOf, firstNameOf, useMe } from './me';
import {
  LOCALES,
  chooseLocale,
  loadSavedLocale,
  markPartialNoteSeen,
  partialNoteSeen,
  setVernacularAllowed,
  useT,
  type Locale,
  type MessageKey,
} from '../../i18n';
import '../admin/AdminLayout.css';
import './Shell.css';
import '../../i18n/i18n.css';

/**
 * The student's portal, and why it is not shaped like the rest of the
 * platform.
 *
 * Operations, campus and company all run on a sidebar: a permanent column of
 * every section, because somebody working a queue all day needs everything
 * one click away and does not mind spending a fifth of the screen on it.
 *
 * A student has none of that. They have five things they ever open, they are
 * on a phone more often than not, and a column of eighteen links is the
 * single thing that made this side read as software their college makes them
 * use. So this side has no sidebar at all:
 *
 *   - five destinations, as a pill bar on desktop and a floating dock on a
 *     phone, which is the shape of every application they already use;
 *   - everything else behind one button, which opens the whole portal as a
 *     grid of tiles - findable in one place, rather than always present and
 *     always in the way;
 *   - and the page itself gets the full width of the screen.
 */
type Item = { to: string; label: string; end?: boolean; module?: string };

/**
 * Every section, grouped by what a student is trying to do.
 *
 * The groups are for the launcher, not for a menu that is always open. Each
 * carries a line saying what the group is for, because a grid of eighteen
 * tiles with no headings is a worse menu than the sidebar it replaced.
 *
 * Labels stay in English: they are translated on the way out, keyed by that
 * English text (`nav.<label>`), and the same label picks the icon - so a
 * section names its shape and its translation by naming itself.
 */
const GROUPS: { label: string; lede: string; items: Item[] }[] = [
  {
    label: 'Placements',
    lede: 'Roles, the ones you sent, and what happens next',
    items: [
      { to: '/student', label: 'Overview', end: true },
      { to: '/student/jobs', label: 'Jobs' },
      { to: '/student/applications', label: 'My applications' },
      { to: '/student/interviews', label: 'Interviews' },
      { to: '/student/assessments', label: 'Assessments' },
    ],
  },
  {
    label: 'Get ready',
    lede: 'Rehearsal. None of it is marked, none of it is seen',
    items: [
      { to: '/student/practice', label: 'Aptitude practice', module: 'dev.aptitude' },
      { to: '/student/interview', label: 'Mock interview', module: 'dev.mockInterview' },
      { to: '/student/gd', label: 'Group discussion', module: 'dev.gd' },
      { to: '/student/soft-skills', label: 'Soft skills', module: 'dev.softSkills' },
      { to: '/student/events', label: 'Events', module: 'showcase.campusWeeks' },
      { to: '/student/guides', label: 'Guides' },
      { to: '/student/counselling', label: 'Career counselling' },
    ],
  },
  {
    label: 'You',
    lede: 'Your record, and who is allowed to read it',
    items: [
      { to: '/student/profile', label: 'My profile' },
      { to: '/student/resume', label: 'Resume' },
      { to: '/student/showcase', label: 'Showcase', module: 'showcase.student' },
      { to: '/student/feed', label: 'Feed' },
      { to: '/student/badges', label: 'My badges' },
      { to: '/student/privacy', label: 'Privacy', module: 'compliance.consent' },
    ],
  },
];

/**
 * The four that are always on the bar, plus Prepare, which is whichever
 * rehearsal section the institution has actually switched on.
 *
 * Chosen by what somebody opens between lectures, not by what the portal
 * contains: is anything new, what can I apply to, where are the ones I sent,
 * how do I get better at this, and is my own record in order.
 */
const PRIMARY: { to: string; label: string; icon: string; text: MessageKey; end?: boolean }[] = [
  { to: '/student', label: 'Overview', icon: 'Overview', text: 'layout.home', end: true },
  { to: '/student/jobs', label: 'Jobs', icon: 'Jobs', text: 'nav.Jobs' },
  {
    to: '/student/applications',
    label: 'My applications',
    icon: 'My applications',
    text: 'layout.applied',
  },
  { to: '__prepare__', label: 'Prepare', icon: 'Aptitude practice', text: 'layout.prepare' },
  { to: '/student/profile', label: 'My profile', icon: 'My profile', text: 'layout.profile' },
];

/**
 * What Apli says a page is for, keyed by route.
 *
 * The companion in the corner is on every screen, and a helper that says the
 * same sentence everywhere is worse than none. So each section gets one line
 * about what it is actually for and where the next step is - written for
 * somebody who landed here and is not sure why.
 *
 * Longest match wins, so a detail page inherits its section's line rather
 * than falling through to the default.
 */
const PAGE_HELP: { path: string; title: string; body: string; to?: string; cta?: string }[] = [
  {
    path: '/student/jobs',
    title: 'Everything here is open to you',
    body: 'You only see roles you already clear on course, marks and batch, so nothing on this page can reject you on eligibility. The match figure is about your skills, not a score on you.',
    to: '/student/profile',
    cta: 'Improve what I match on',
  },
  {
    path: '/student/applications',
    title: 'Where each one has got to',
    body: 'A company opens applications in its own time. Silence here usually means not yet read, not turned down - the stage changes the moment they move.',
  },
  {
    path: '/student/interviews',
    title: 'Every round with a date on it',
    body: 'Online rounds show a joining link once the company sets one. Be there five minutes early; if something goes wrong, tell your placement cell rather than the company.',
    to: '/student/interview',
    cta: 'Rehearse one first',
  },
  {
    path: '/student/assessments',
    title: 'Tests a company has set you',
    body: 'These are marked and they count. Check the window and the time limit before you start, and use a connection you trust.',
  },
  {
    path: '/student/practice',
    title: 'Nobody sees this',
    body: 'Practice produces no claim and no record. It is here so the first time you meet a question like this is not in a room that counts.',
  },
  {
    path: '/student/interview',
    title: 'A rehearsal, not a round',
    body: 'Nothing here reaches a company. Say the answers out loud - reading them in your head is the thing that catches everybody out on the day.',
  },
  {
    path: '/student/gd',
    title: 'Practice for the group round',
    body: 'A group discussion is marked on whether you moved the conversation, not on how much of it you took. Getting one clear point in early beats talking throughout.',
  },
  {
    path: '/student/soft-skills',
    title: 'The part no marksheet holds',
    body: 'Most rejections after the first round are about how something was explained, not about whether it was known. This is the practice for that.',
  },
  {
    path: '/student/guides',
    title: 'Short, and written for here',
    body: 'Written for campus hiring in India specifically - what a round actually asks, what a recruiter reads first, what is worth saying no to.',
  },
  {
    path: '/student/counselling',
    title: 'Ask somebody a real question',
    body: 'For the ones the portal cannot answer: which offer, which branch, whether to wait. What you write goes to your placement cell, not to a company.',
  },
  {
    path: '/student/profile',
    title: 'This is what a recruiter reads',
    body: 'Marks and batch come from your college and you cannot edit them. Everything else is yours, and the parts still blank are the parts a filter falls at.',
  },
  {
    path: '/student/resume',
    title: 'One page, on file',
    body: 'A company sees this before it sees anything else you have done here. One page, no photo, and every claim on it something you can talk about for two minutes.',
  },
  {
    path: '/student/showcase',
    title: 'Work, not words',
    body: 'A thing you built says more in ten seconds than a paragraph about being a fast learner. Two finished small projects beat five half-done ones.',
  },
  {
    path: '/student/badges',
    title: 'What you have actually finished',
    body: 'Earned from work that was marked, not from opening pages. That is why a recruiter can read them and believe them.',
  },
  {
    path: '/student/privacy',
    title: 'Who can see you',
    body: 'Set what leaves your college and what does not. Turning something off never affects whether you are eligible for a role.',
  },
  {
    path: '/student/events',
    title: 'What is on, on campus',
    body: 'Drives, talks and weeks your college has put on. Some need a place booked in advance, and those fill.',
  },
  {
    path: '/student/feed',
    title: 'What your campus is doing',
    body: 'Notices from your placement cell and what other students in your batch are getting through. It is here so a quiet week does not feel like an empty one.',
  },
];

const DEFAULT_HELP = {
  title: 'This is your side of the portal',
  body: 'Everything here is either something to apply to, something to practise, or your own record. If a page is not clear, your placement cell can see the same screen you can.',
  to: '/student',
  cta: 'Back to your overview',
};

/**
 * Where a page was opened from, so it can offer the way back.
 *
 * A link that carries `?from=` says which section sent the reader here, and
 * the layout puts one line at the top of whatever they landed on. Doing it
 * here rather than on each destination means a section can link anywhere in
 * the student side without that page having to know it exists.
 *
 * Only sections named here are honoured, so a hand-typed `?from=` cannot
 * point the way back at anything the portal does not own.
 */
const CAME_FROM: Record<string, { to: string; label: string }> = {
  badges: { to: '/student/badges', label: 'Back to my badges' },
  overview: { to: '/student', label: 'Back to your overview' },
  assessments: { to: '/student/assessments', label: 'Back to assessments' },
  interviews: { to: '/student/interviews', label: 'Back to interviews' },
  applications: { to: '/student/applications', label: 'Back to your applications' },
  jobs: { to: '/student/jobs', label: 'Back to jobs' },
};

/** Whichever of a list of paths the current one sits deepest inside. */
function bestMatch<T extends { path?: string; to?: string; end?: boolean }>(
  list: T[],
  here: string,
): T | undefined {
  let best: T | undefined;
  let bestLen = -1;
  for (const c of list) {
    const p = c.path ?? c.to ?? '';
    const hit = c.end ? here === p : here === p || here.startsWith(p + '/');
    if (hit && p.length > bestLen) {
      best = c;
      bestLen = p.length;
    }
  }
  return best;
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasModule } = useAuth();
  const { t, tNav, locale } = useT();
  const me = useMe();
  const vernacular = hasModule('channel.vernacular');
  const [showNote, setShowNote] = useState(false);
  /** The whole portal, as a grid. */
  const [launcher, setLauncher] = useState(false);
  /** The account menu behind the avatar. */
  const [account, setAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const back = CAME_FROM[params.get('from') ?? ''];

  // English unless the institution has regional languages; the student's own
  // choice is kept either way, and the account's saved choice wins on a new
  // device.
  useEffect(() => {
    setVernacularAllowed(vernacular);
    if (vernacular) void loadSavedLocale(true);
  }, [vernacular]);

  // Neither overlay should survive the navigation that was made from it.
  useEffect(() => {
    setLauncher(false);
    setAccount(false);
  }, [pathname]);

  // The page behind the launcher must not scroll under it.
  useEffect(() => {
    if (!launcher) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLauncher(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [launcher]);

  useEffect(() => {
    if (!account) return;
    function onDown(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) setAccount(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccount(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [account]);

  function pick(next: Locale) {
    chooseLocale(next);
    if (next !== 'en' && !partialNoteSeen()) setShowNote(true);
  }

  async function onSignOut() {
    forgetMe();
    await logout();
    navigate('/login', { replace: true });
  }

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((s) => !s.module || hasModule(s.module)),
      })).filter((g) => g.items.length > 0),
    [hasModule],
  );

  /**
   * Prepare goes wherever rehearsal actually starts for this institution.
   *
   * The aptitude, mock interview and discussion sections are each behind a
   * module an institution can switch off, so a fixed target would be a
   * primary tab into a page that says "not available here". It takes the
   * first one that is on, and guides - which nothing gates - if none are.
   */
  const prepareTo = useMemo(() => {
    const ready = groups.find((g) => g.label === 'Get ready');
    return ready?.items[0]?.to ?? '/student/guides';
  }, [groups]);

  const primary = useMemo(
    () => PRIMARY.map((p) => (p.to === '__prepare__' ? { ...p, to: prepareTo } : p)),
    [prepareTo],
  );

  const help = bestMatch(PAGE_HELP, pathname) ?? DEFAULT_HELP;
  const name = firstNameOf(me?.fullName ?? user?.fullName);
  const percent = me?.completion.percent ?? null;
  const verified = me?.batch?.isFrozen ?? false;
  const initials = initialsOf(me?.fullName ?? user?.fullName ?? '');

  /** The five, drawn once and used by both the bar and the dock. */
  const tabs = primary.map((p) => {
    const Icon = iconFor(p.icon);
    return (
      <NavLink
        key={p.label}
        to={p.to}
        end={p.end ?? false}
        className={({ isActive }) => `sh-tab ${isActive ? 'is-current' : ''}`}
      >
        <Icon className="sh-tab-icon" />
        <span>{t(p.text)}</span>
      </NavLink>
    );
  });

  return (
    <div className="sh">
      {/*
        One bar, floating over the page.

        Brand, the five destinations, and the three controls that are true
        everywhere: everything else, anything new, and who is signed in.
      */}
      <header className="sh-top">
        <div className="sh-top-in">
          <Link to="/student" className="sh-brand">
            <ApliFace size={30} />
            <span>
              Apli<i>.ai</i>
            </span>
          </Link>

          <nav className="sh-bar" aria-label="Student sections">
            {tabs}
          </nav>

          <div className="sh-top-right">
            {percent !== null && percent < 100 && (
              <Link className="sh-chip" to="/student/profile" title={t('layout.finishProfile')}>
                <span className="sh-chip-ring" style={{ ['--p' as string]: `${percent}%` }}>
                  <i>{percent}</i>
                </span>
                <b>{t('layout.yourProfile')}</b>
              </Link>
            )}

            {verified && percent === 100 && (
              <span className="sh-chip is-ok" title={t('layout.verifiedHint')}>
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <b>{t('layout.verified')}</b>
              </span>
            )}

            <button
              type="button"
              className="sh-all"
              onClick={() => setLauncher(true)}
              aria-label={t('layout.everything')}
            >
              <GridIcon />
              <span>{t('layout.everything')}</span>
            </button>

            <NotificationBell />

            <div className="sh-account" ref={accountRef}>
              <button
                type="button"
                className="sh-avatar"
                onClick={() => setAccount((v) => !v)}
                aria-expanded={account}
                aria-label={t('layout.account')}
              >
                {initials}
              </button>

              {account && (
                <div className="sh-account-pop">
                  <p className="sh-account-name">{me?.fullName ?? user?.fullName}</p>
                  <p className="sh-account-mail">{user?.email}</p>
                  {me?.batch && (
                    <p className="sh-account-batch">
                      {[me.batch.college, me.batch.course, `Class of ${me.batch.graduationYear}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <Link className="sh-account-link" to="/student/profile">
                    {tNav('My profile')}
                  </Link>
                  <Link className="sh-account-link" to="/student/privacy">
                    {tNav('Privacy')}
                  </Link>

                  {vernacular && (
                    <div className="lang-switch" role="radiogroup" aria-label={t('layout.language')}>
                      {LOCALES.map((l) => (
                        <button
                          key={l.value}
                          type="button"
                          role="radio"
                          aria-checked={locale === l.value}
                          lang={l.value}
                          className={`lang-opt ${locale === l.value ? 'is-on' : ''}`}
                          onClick={() => pick(l.value)}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <button type="button" className="sh-account-out" onClick={onSignOut}>
                    <SignOutIcon className="sh-out-icon" />
                    {t('layout.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="sh-page">
        {back && (
          <Link className="sh-back" to={back.to}>
            {back.label}
          </Link>
        )}

        {showNote && (
          <p className="lang-note" role="status">
            {t('layout.partialNote')}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                markPartialNoteSeen();
                setShowNote(false);
              }}
            >
              {t('layout.ok')}
            </button>
          </p>
        )}
        {children}
      </main>

      {/*
        The dock, on a phone.

        Detached from the edge and floating over the page rather than nailed
        across the bottom of it: the thumb reaches the middle of the screen
        far more easily than the corners, and a bar welded to the edge is the
        one thing that always reads as a website pretending to be an app.
      */}
      <nav className="sh-dock" aria-label="Student sections">
        {tabs}
        <button type="button" className="sh-tab sh-tab-all" onClick={() => setLauncher(true)}>
          <GridIcon className="sh-tab-icon" />
          <span>{t('layout.all')}</span>
        </button>
      </nav>

      {/* Everything there is, as a grid. */}
      {launcher && (
        <div className="sh-launch" role="dialog" aria-modal="true" aria-label={t('layout.everything')}>
          <button
            type="button"
            className="sh-launch-scrim"
            onClick={() => setLauncher(false)}
            aria-label={t('layout.closeMenu')}
          />

          <div className="sh-launch-panel">
            <div className="sh-launch-head">
              <span className="sh-launch-me">
                <span className="sh-avatar is-big" aria-hidden="true">
                  {initials}
                </span>
                <span>
                  <b>{name ? `${name}'s portal` : 'Your portal'}</b>
                  <small>{me?.batch?.college ?? user?.email}</small>
                </span>
              </span>
              <button
                type="button"
                className="sh-launch-x"
                onClick={() => setLauncher(false)}
                aria-label={t('layout.closeMenu')}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="sh-launch-body">
              {groups.map((g) => (
                <section key={g.label} className="sh-launch-group">
                  <p className="sh-launch-tag">{tNav(g.label)}</p>
                  <p className="sh-launch-lede">{g.lede}</p>
                  <div className="sh-launch-grid">
                    {g.items.map((item) => {
                      const Icon = iconFor(item.label);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end ?? false}
                          onClick={() => setLauncher(false)}
                          className={({ isActive }) =>
                            `sh-launch-tile ${isActive ? 'is-current' : ''}`
                          }
                        >
                          <span className="sh-launch-icon">
                            <Icon />
                          </span>
                          <b>{tNav(item.label)}</b>
                        </NavLink>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <button type="button" className="sh-launch-out" onClick={onSignOut}>
              <SignOutIcon className="sh-out-icon" />
              {t('layout.signOut')}
            </button>
          </div>
        </div>
      )}

      {/* Apli, always within reach, silent until asked. */}
      <ApliBubble tips={help} />
    </div>
  );
}
