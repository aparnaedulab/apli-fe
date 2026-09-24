import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApliFace } from './Apli';
import {
  LOCALES,
  chooseLocale,
  loadSavedLocale,
  markPartialNoteSeen,
  partialNoteSeen,
  setVernacularAllowed,
  useT,
  type Locale,
} from '../../i18n';
import '../admin/AdminLayout.css';
import './Shell.css';
import '../../i18n/i18n.css';

/**
 * The student's sections, grouped by what they are trying to do.
 *
 * What works sits at the top, in its own groups. Everything else is behind
 * one heading at the foot that says "coming soon" once, instead of thirteen
 * rows each carrying a badge that says it again.
 *
 * The unbuilt sections stay on the rail rather than being hidden: a student
 * planning a final year should be able to see the shape of what the portal
 * will do for them, and a menu that grows one item at a time never shows
 * that. But they are folded to three, because the shape is the point, not
 * the inventory - and the mark is presentation, not a gate. A folded section
 * still opens if it is clicked.
 *
 * Labels stay in English: they are translated on the way out, keyed by that
 * English text (`nav.<label>`), and an unknown label shows as written.
 */
type Item = { to: string; label: string; end?: boolean; module?: string };

/**
 * The sections that work today.
 *
 * Split along the line that actually matters to a student: rehearsal, which
 * nobody sees and which produces no claim, against work that somebody marks
 * and that ends up on their record.
 *
 * A work simulation is not on the rail: it is reached from the application it
 * belongs to, which is the only place it means anything. A company sets one
 * as a hiring round, so it is assessed work rather than something to browse.
 *
 * Each of the rehearsal pages checks its own module and says so when an
 * institution has it switched off; naming the module here keeps it off the
 * menu entirely rather than offering a door into that message.
 */
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: 'Placements',
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
 * The rest, in the order they would be built.
 *
 * Empty today, and the heading goes with it rather than standing over
 * nothing. It comes back with the next section that reaches the menu before
 * it is finished.
 */
const SOON: Item[] = [];

/** How many of them are shown before the rest are folded away. */
const SOON_SHOWN = 3;

/**
 * Where a page was opened from, so it can offer the way back.
 *
 * A link that carries `?from=` says which section sent the reader here, and
 * the layout puts one line at the top of whatever they landed on. Doing it
 * here rather than on each destination means a section can link anywhere in
 * the student side without that page having to know it exists - and a
 * student who followed a badge into their applications is not left working
 * out how to get back to the badges.
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

/** Two letters for the corner, from whatever name we were given. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasModule } = useAuth();
  const { t, tNav, locale } = useT();
  const vernacular = hasModule('channel.vernacular');
  const [showNote, setShowNote] = useState(false);
  /** Whether the whole of the not-built list is on the rail. */
  const [allSoon, setAllSoon] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = CAME_FROM[params.get('from') ?? ''];

  // English unless the institution has regional languages; the student's own
  // choice is kept either way, and the account's saved choice wins on a new
  // device.
  useEffect(() => {
    setVernacularAllowed(vernacular);
    if (vernacular) void loadSavedLocale(true);
  }, [vernacular]);

  function pick(next: Locale) {
    chooseLocale(next);
    if (next !== 'en' && !partialNoteSeen()) setShowNote(true);
  }

  async function onSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((s) => !s.module || hasModule(s.module)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="sh">
      <aside className="sh-rail">
        <Link to="/student" className="sh-brand">
          <ApliFace size={30} />
          <span>Apli.ai</span>
        </Link>

        <nav aria-label="Student sections">
          {groups.map((g) => (
            <div key={g.label} className="sh-group">
              <p className="sh-group-label">{tNav(g.label)}</p>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? false}
                  className={({ isActive }) => `sh-link ${isActive ? 'is-current' : ''}`}
                >
                  {tNav(item.label)}
                </NavLink>
              ))}
            </div>
          ))}

          {/*
            Said once, at the foot, instead of on every row. Thirteen badges
            all saying the same word stop being read as information and start
            being read as texture. Nothing is unbuilt today, so the heading is
            not there either - it returns with the next section that does.
          */}
          {SOON.length > 0 && (
            <div className="sh-group sh-soon">
              <p className="sh-group-label">{t('layout.comingSoon')}</p>
              {(allSoon ? SOON : SOON.slice(0, SOON_SHOWN)).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sh-link is-soon ${isActive ? 'is-current' : ''}`}
                >
                  {tNav(item.label)}
                </NavLink>
              ))}

              {SOON.length > SOON_SHOWN && (
                <button
                  type="button"
                  className="sh-more"
                  onClick={() => setAllSoon((v) => !v)}
                  aria-expanded={allSoon}
                >
                  {allSoon
                    ? t('layout.showFewer')
                    : t('layout.showAll', { n: SOON.length - SOON_SHOWN })}
                </button>
              )}
            </div>
          )}
        </nav>

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

        {/* Who is signed in, at the foot of the rail where it is out of the
            way until it is wanted. */}
        <div className="sh-me">
          <span className="sh-initials" aria-hidden="true">
            {initialsOf(user?.fullName ?? '')}
          </span>
          <span className="sh-me-who">
            <b>{user?.fullName}</b>
            <small>{user?.email}</small>
          </span>
          <button type="button" className="sh-out" onClick={onSignOut}>
            {t('layout.signOut')}
          </button>
        </div>
      </aside>

      <main className="sh-main">
        <div className="sh-page">
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
        </div>
      </main>
    </div>
  );
}
