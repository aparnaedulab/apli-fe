import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import ApliLogo from '../../components/ApliLogo';
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
export function AppFrame({
  nav,
  home,
  profile,
  children,
}: {
  nav: NavItem[];
  home: string;
  /** Where "Your profile" goes in the menu, when there is one. */
  profile?: string;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

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
    <div className={`sa ${scrolled ? 'is-scrolled' : ''}`}>
      <header className="sa-top">
        <div className="sa-wrap sa-top-in">
          <Link to={home} className="sa-logo" aria-label="Apli.ai, home">
            <ApliLogo />
          </Link>
          <nav className="sa-nav" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
                {n.badge ? <span className="sa-nav-badge">{n.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="sa-me" ref={menu}>
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
      <main className="sa-main">{children}</main>
    </div>
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
