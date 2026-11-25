import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import ApliLogo from '../../components/ApliLogo';
import NotificationBell from '../../components/NotificationBell';
import AppGuide from '../../components/guide/AppGuide';
import { inSection, markNotificationsRead, useNotifications } from '../../components/useNotifications';
import { useAuth } from '../../auth/AuthContext';
import type { SimulationCard } from '../../api/studentApp';
import { LEVEL_LABEL } from '../../api/studentApp';
import './student-app.css';

/**
 * The frame every student screen sits in, drawn in the landing page's
 * language: the same header, the same blue, the same tiles and cards, so
 * signing in feels like walking further into the same place.
 */
export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  badge?: number;
}

const STUDENT_NAV: NavItem[] = [
  { to: '/student', label: 'Dashboard', end: true },
  { to: '/student/simulations', label: 'Simulations' },
  { to: '/student/certificates', label: 'Certificates' },
  { to: '/student/interviews', label: 'Interviews' },
  { to: '/student/jobs', label: 'Jobs' },
];

/** The student app's frame. */
export default function Shell({ children }: { children: ReactNode }) {
  return (
    <AppFrame nav={STUDENT_NAV} home="/student" profile="/student/profile">
      {children}
    </AppFrame>
  );
}

/**
 * The frame both apps sit in - students and companies - so they are one
 * product: the logo, a few places to go, and the person's own menu.
 */
export interface FrameProps {
  nav: NavItem[];
  home: string;
  /** Where "Your profile" goes in the menu, when there is one. */
  profile?: string;
  /** Places that are not visited every day - set-up, people, settings - kept in the person's menu. */
  menu?: NavItem[];
  /** Beside the person's menu: a bell, the institution being looked after. */
  extra?: ReactNode;
}

export function AppFrame({
  className = '',
  children,
  ...header
}: FrameProps & {
  /** On the frame's root, for an app that adds its own styles. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`sa ${className}`}>
      <AppHeader {...header} />
      <main className="sa-main">{children}</main>
    </div>
  );
}

/**
 * The header on its own: the logo, a few places to go, and the person's
 * menu. AppFrame wraps a page in it; the platform console, whose pages draw
 * their own body, places just this.
 */
export function AppHeader({ nav, home, profile, menu: menuLinks = [], extra }: FrameProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const { items } = useNotifications();
  const { pathname } = useLocation();

  // What is new in each section: its unread notifications.
  const unreadIn = (n: NavItem) => items.filter((x) => !x.readAt && inSection(x.link, n.to, n.end));

  // Opening a section counts as seeing what is new there: after a moment its
  // count clears (the bell's count too).
  useEffect(() => {
    const here = [...nav, ...menuLinks]
      .filter((n) => inSection(pathname, n.to, n.end))
      .sort((a, b) => b.to.length - a.to.length)[0];
    if (!here) return;
    const ids = unreadIn(here).map((x) => x.id);
    if (!ids.length) return;
    const t = window.setTimeout(() => void markNotificationsRead(ids), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, items]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  // The header gains a shadow once the page moves, as on the landing page.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const name = user?.fullName ?? '';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?';

  return (
    <header className={`sa-top ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="sa-wrap sa-top-in">
        <Link to={home} className="sa-logo" aria-label="Apli.ai, home">
          <ApliLogo />
        </Link>
        <nav className="sa-nav" aria-label="Main">
          {nav.map((n) => {
            // Waiting work the page counts itself, plus anything new here.
            const count = (n.badge ?? 0) + unreadIn(n).length;
            return (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
                {count ? (
                  <span className="sa-nav-badge" aria-label={`${count} new`}>
                    {count > 9 ? '9+' : count}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
        {/* What the page adds, then the bell: every app tells its people what happened. */}
        <div className="sa-extra">
          {extra}
          <AppGuide />
          <span className="sa-bell">
            <NotificationBell />
          </span>
        </div>
        <div className="sa-me has-extra" ref={menu}>
          <button
            type="button"
            className="sa-me-btn"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Your account"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sa-avatar">{initials}</span>
            <span className="sa-me-name">{name.split(/\s+/)[0]}</span>
            <span className="sa-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {open && (
            <div className="sa-menu" role="menu">
              <p className="sa-menu-who">
                <b>{name}</b>
                <span>{user?.email}</span>
              </p>
              {profile && (
                <Link to={profile} role="menuitem" className="sa-menu-item" onClick={() => setOpen(false)}>
                  Your profile
                </Link>
              )}
              {menuLinks.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  end={m.end}
                  role="menuitem"
                  className="sa-menu-item"
                  onClick={() => setOpen(false)}
                >
                  {m.label}
                </NavLink>
              ))}
              {menuLinks.length > 0 && <hr className="sa-menu-rule" />}
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const TONES = ['blue', 'green', 'orange', 'violet'] as const;

/** The landing page's four tones, one per company, always the same for it. */
export function toneOf(name: string): (typeof TONES)[number] {
  const h = [...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  return TONES[h % TONES.length]!;
}

/** A company's logo, or its initials on its tone - the landing page's tile. */
export function CompanyTile({ company, big }: { company: SimulationCard['company']; big?: boolean }) {
  return (
    <span className={`sa-tile is-${toneOf(company.name)} ${big ? 'is-big' : ''}`} aria-hidden="true">
      {company.logoUrl ? (
        <img src={company.logoUrl} alt="" />
      ) : (
        company.name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0])
          .join('')
      )}
    </span>
  );
}

/** "Data · 4 hrs · 3 tasks" */
export function metaLine(i: SimulationCard): string {
  return `${i.field} · ${i.hours} hrs · ${i.tasks} task${i.tasks === 1 ? '' : 's'}`;
}

/** Lets a card's soft light follow the pointer. */
export function trackPointer(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/** One simulation as a card, the way the landing page's catalogue draws it. */
/** A student's own place on a simulation, in two or three words. */
export const MY_STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: 'In progress', tone: 'violet' },
  IN_REVIEW: { label: 'In review', tone: 'blue' },
  NEEDS_WORK: { label: 'Changes asked', tone: 'orange' },
  COMPLETED: { label: 'Verified', tone: 'green' },
  LEFT: { label: 'Paused', tone: 'grey' },
};

/** The cover: the company's picture, or its tone with its initials, drawn. */
export function Cover({ sim, tall }: { sim: SimulationCard; tall?: boolean }) {
  const tone = toneOf(sim.company.name);
  return (
    <span className={`sa-cover is-${tone} ${tall ? 'is-tall' : ''}`} aria-hidden="true">
      {sim.coverUrl ? (
        <img src={sim.coverUrl} alt="" loading="lazy" />
      ) : (
        <span className="sa-cover-art">
          <i />
          <i />
          <i />
          <b>{sim.field}</b>
        </span>
      )}
    </span>
  );
}

/**
 * One simulation as a card: its cover with the company on it, where the
 * student stands, what it is and how long it takes.
 */
export function SimulationTile({ i, onHide, index = 0 }: { i: SimulationCard; onHide?: () => void; index?: number }) {
  const mine = i.myStatus ? MY_STATUS[i.myStatus] : null;
  return (
    <article className="sa-sim" onPointerMove={trackPointer} style={{ '--d': index } as CSSProperties}>
      <Link to={`/student/simulations/${i.slug}`} className="sa-sim-link">
        <span className="sa-sim-cover">
          <Cover sim={i} />
          <span className="sa-sim-badge">
            <CompanyTile company={i.company} />
          </span>
          {mine ? (
            <span className={`sa-sim-state is-${mine.tone}`}>{mine.label}</span>
          ) : i.isNew ? (
            <span className="sa-sim-state is-new">New</span>
          ) : null}
        </span>
        <span className="sa-sim-body">
          <span className="sa-sim-co">{i.company.name}</span>
          <b className="sa-sim-title">{i.title}</b>
          <span className="sa-sim-summary">{i.summary}</span>
          <span className="sa-sim-facts">
            <span>{i.field}</span>
            <span>{LEVEL_LABEL[i.level]}</span>
            <span>~{i.hours} hrs</span>
            <span>
              {i.tasks} task{i.tasks === 1 ? '' : 's'}
            </span>
          </span>
          {i.fromCollege > 0 && (
            <span className="sa-peers">
              <span aria-hidden="true">●</span> {i.fromCollege} from your college finished this
            </span>
          )}
          <span className="sa-sim-go">
            {mine ? 'Open' : 'Have a look'} <span aria-hidden="true">→</span>
          </span>
        </span>
      </Link>
      {onHide && (
        <button type="button" className="sa-sim-hide" onClick={onHide} aria-label={`Not for me: ${i.title}`} title="Not for me">
          ×
        </button>
      )}
    </article>
  );
}
