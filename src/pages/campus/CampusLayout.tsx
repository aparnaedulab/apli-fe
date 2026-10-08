import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import '../admin/AdminLayout.css';
import '../company/Company.css';
import ApliLogo from '../../components/ApliLogo';
import { NAV_ICONS } from '../admin/navIcons';

type Section = { to: string; label: string; end: boolean; icon: string; needs?: string; module?: string };

/**
 * The placement cell's portal.
 *
 * It had twenty-three links in three groups - more than anybody reads at a
 * glance. The everyday ones are a short flat list now, in the order a
 * placement officer works; everything else is folded under "More tools",
 * which opens itself on any of its pages. Same shell and palette as the
 * recruiter portal (`.co`), so the two read as one product.
 */
const MAIN: Section[] = [
  { to: '/campus', label: 'Overview', end: true, icon: 'overview' },
  { to: '/campus/requests', label: 'Job requests', end: false, icon: 'jobs', needs: 'posting:read' },
  { to: '/campus/drives', label: 'Placement seasons', end: false, icon: 'drives', needs: 'drive:read' },
  { to: '/campus/campus-drives', label: 'Campus drives', end: false, icon: 'companies', needs: 'drive:read' },
  { to: '/campus/programs', label: 'Students', end: false, icon: 'students', needs: 'batch:read' },
  { to: '/campus/batches', label: 'Batches', end: false, icon: 'batches', needs: 'batch:read' },
  { to: '/campus/offers', label: 'Offers', end: false, icon: 'applications', needs: 'application:read', module: 'trust.offerProtection' },
  { to: '/campus/reports', label: 'Reports', end: false, icon: 'audit', needs: 'report:read', module: 'compliance.reports' },
  { to: '/campus/team', label: 'Team', end: false, icon: 'users', needs: 'team:manage' },
];

const MORE: Section[] = [
  { to: '/campus/drive-day', label: 'Drive day', end: false, icon: 'drives', needs: 'drive:write', module: 'ops.driveDay' },
  { to: '/campus/flags', label: 'Flagged roles', end: false, icon: 'audit', needs: 'posting:read', module: 'trust.scamShield' },
  { to: '/campus/pools', label: 'Pooled drives', end: false, icon: 'batches', needs: 'drive:read', module: 'ops.pooledDrives' },
  { to: '/campus/events', label: 'Events', end: false, icon: 'invites', needs: 'drive:read', module: 'showcase.campusWeeks' },
  { to: '/campus/employers', label: 'Employers', end: false, icon: 'companies', needs: 'drive:read', module: 'ops.employerCrm' },
  { to: '/campus/at-risk', label: 'Students to check on', end: false, icon: 'students', needs: 'student:read', module: 'ops.atRisk' },
  { to: '/campus/counselling', label: 'Counselling', end: false, icon: 'users', needs: 'student:read' },
  { to: '/campus/readiness', label: 'Readiness', end: false, icon: 'overview', needs: 'student:read', module: 'dev.readiness' },
  { to: '/campus/internships', label: 'Internships', end: false, icon: 'jobs', needs: 'student:read', module: 'compliance.internships' },
  { to: '/campus/stories', label: 'Campus stories', end: false, icon: 'invites', needs: 'student:read', module: 'showcase.stories' },
  { to: '/campus/alumni', label: 'Alumni board', end: false, icon: 'users', needs: 'student:read', module: 'community.alumni' },
  { to: '/campus/consent', label: 'Student consent', end: false, icon: 'settings', needs: 'student:read', module: 'compliance.consent' },
  { to: '/campus/skills', label: 'Skill demand', end: false, icon: 'overview', needs: 'report:read', module: 'ops.skillHeatmap' },
  { to: '/campus/messages', label: 'WhatsApp messages', end: false, icon: 'invites', needs: 'report:read', module: 'channel.whatsapp' },
];

export default function CampusLayout({ children }: { children: ReactNode }) {
  const { user, logout, can, hasModule } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const allowed = (s: Section) => (!s.needs || can(s.needs)) && (!s.module || hasModule(s.module));
  const main = MAIN.filter(allowed);
  const more = MORE.filter(allowed);

  // "More tools" opens itself when one of its pages is the one being viewed.
  const [moreOpen, setMoreOpen] = useState(() => more.some((s) => pathname.startsWith(s.to)));

  async function onSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const link = (s: Section) => {
    const Icon = NAV_ICONS[s.icon];
    return (
      <NavLink key={s.to} to={s.to} end={s.end} className={({ isActive }) => `admin-link ${isActive ? 'is-current' : ''}`}>
        {Icon && <Icon className="admin-link-icon" />}
        <span className="admin-link-text">{s.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="admin co">
      <aside className="admin-nav">
        <Link to="/" className="admin-brand" aria-label="Apli.ai, home">
          <ApliLogo className="brand-logo" />
        </Link>
        <p className="co-portal">Placement cell</p>

        <nav aria-label="Campus sections" className="co-groups">
          {main.map(link)}

          {more.length > 0 && (
            <>
              <button
                type="button"
                className={`admin-link co-more ${moreOpen ? 'is-open' : ''}`}
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
              >
                <span className="co-more-dots" aria-hidden="true">
                  ⋯
                </span>
                <span className="admin-link-text">More tools</span>
                <span className="co-more-caret" aria-hidden="true" />
              </button>
              {moreOpen && <div className="co-more-list">{more.map(link)}</div>}
            </>
          )}
        </nav>

        <div className="admin-user">
          <p className="admin-user-name">{user?.fullName}</p>
          <p className="admin-user-email">{user?.email}</p>
          <button type="button" className="admin-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
