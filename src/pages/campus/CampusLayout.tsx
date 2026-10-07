import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import '../admin/AdminLayout.css';
import ApliLogo from '../../components/ApliLogo';

type Section = { to: string; label: string; end: boolean; needs?: string; module?: string };

/** Grouped by the placement cell's jobs; a group with nothing visible drops its heading. */
const GROUPS: { label: string; items: Section[] }[] = [
  {
    label: 'Placements',
    items: [
      { to: '/campus', label: 'Overview', end: true },
      { to: '/campus/programs', label: 'Courses & students', end: false, needs: 'batch:read' },
      { to: '/campus/batches', label: 'Batches', end: false, needs: 'batch:read' },
      { to: '/campus/drives', label: 'Seasons', end: false, needs: 'drive:read' },
      { to: '/campus/campus-drives', label: 'Drives', end: false, needs: 'drive:read' },
      { to: '/campus/drive-day', label: 'Drive day', end: false, needs: 'drive:write', module: 'ops.driveDay' },
      { to: '/campus/requests', label: 'Job requests', end: false, needs: 'posting:read' },
      { to: '/campus/flags', label: 'Flagged roles', end: false, needs: 'posting:read', module: 'trust.scamShield' },
      { to: '/campus/offers', label: 'Offers', end: false, needs: 'application:read', module: 'trust.offerProtection' },
      { to: '/campus/pools', label: 'Pooled drives', end: false, needs: 'drive:read', module: 'ops.pooledDrives' },
      { to: '/campus/events', label: 'Events', end: false, needs: 'drive:read', module: 'showcase.campusWeeks' },
      { to: '/campus/employers', label: 'Employers', end: false, needs: 'drive:read', module: 'ops.employerCrm' },
    ],
  },
  {
    label: 'Students',
    items: [
      { to: '/campus/at-risk', label: 'Students to check on', end: false, needs: 'student:read', module: 'ops.atRisk' },
      // The other half of that list: students who put their hand up.
      { to: '/campus/counselling', label: 'Counselling', end: false, needs: 'student:read' },
      { to: '/campus/readiness', label: 'Readiness', end: false, needs: 'student:read', module: 'dev.readiness' },
      { to: '/campus/internships', label: 'Internships', end: false, needs: 'student:read', module: 'compliance.internships' },
      { to: '/campus/stories', label: 'Campus stories', end: false, needs: 'student:read', module: 'showcase.stories' },
      { to: '/campus/alumni', label: 'Alumni board', end: false, needs: 'student:read', module: 'community.alumni' },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/campus/reports', label: 'Reports', end: false, needs: 'report:read', module: 'compliance.reports' },
      { to: '/campus/consent', label: 'Student consent', end: false, needs: 'student:read', module: 'compliance.consent' },
      { to: '/campus/skills', label: 'Skill demand', end: false, needs: 'report:read', module: 'ops.skillHeatmap' },
      { to: '/campus/messages', label: 'WhatsApp messages', end: false, needs: 'report:read', module: 'channel.whatsapp' },
      { to: '/campus/team', label: 'Team', end: false, needs: 'team:manage' },
    ],
  },
];


export default function CampusLayout({ children }: { children: ReactNode }) {
  const { user, logout, can, hasModule } = useAuth();

  // Only the sections this role can actually open, and this institution has.
  // A link that leads to a refusal tells somebody they have a job they do not have.
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((s) => (!s.needs || can(s.needs)) && (!s.module || hasModule(s.module))),
  })).filter((g) => g.items.length > 0);
  const navigate = useNavigate();

  async function onSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin">
      <aside className="admin-nav">
        <Link to="/" className="admin-brand" aria-label="Apli.ai, home">
          {/* The real mark, not the placeholder square it used to be. */}
          <ApliLogo className="brand-logo" />
        </Link>

        <nav aria-label="Campus sections">
          {groups.map((g) => (
            <div key={g.label} className="admin-group">
              <p className="admin-nav-label">{g.label}</p>
              {g.items.map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={s.end}
                  className={({ isActive }) => `admin-link ${isActive ? 'is-current' : ''}`}
                >
                  {s.label}
                </NavLink>
              ))}
            </div>
          ))}
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
