import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import { companyDrivesApi } from '../../api/drives';
import '../admin/AdminLayout.css';

const SECTIONS: { to: string; label: string; end: boolean; needs?: string; badge?: 'invitations' }[] = [
  { to: '/company', label: 'Overview', end: true },
  { to: '/company/profile', label: 'Company profile', end: false, needs: 'company:profile' },
  { to: '/company/jobs', label: 'Jobs', end: false, needs: 'job:read' },
  { to: '/company/invitations', label: 'Campus invitations', end: false, badge: 'invitations' },
  { to: '/company/applicants', label: 'Applicants', end: false, needs: 'application:read' },
  { to: '/company/assessments', label: 'Assessments', end: false, needs: 'application:read' },
  { to: '/company/talent', label: 'Talent', end: false, needs: 'application:read' },
  { to: '/company/campus-weeks', label: 'Campus weeks', end: false, needs: 'job:read' },
  { to: '/company/pools', label: 'Pooled drives', end: false, needs: 'posting:target' },
  { to: '/company/institutions', label: 'Institutions', end: false, needs: 'posting:target' },
  { to: '/company/team', label: 'Team', end: false, needs: 'team:manage' },
];

const SOON: string[] = [];

export default function CompanyLayout({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();

  /**
   * Unanswered invitations, on the nav.
   *
   * A college is waiting on this and a recruiter has no reason to open a page
   * called "Campus invitations" on the off-chance. The number is the whole
   * point: without it the invitation sits there until the season is over.
   */
  const [pending, setPending] = useState(0);
  useEffect(() => {
    companyDrivesApi
      .pendingCount()
      .then((r) => setPending(r.count))
      .catch(() => setPending(0));
  }, []);

  // Only the sections this role can actually open. A link that leads to a
  // refusal tells somebody they have a job they do not have.
  const sections = SECTIONS.filter((s) => !s.needs || can(s.needs));
  const navigate = useNavigate();

  async function onSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin">
      <aside className="admin-nav">
        <Link to="/" className="admin-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Apli.ai</span>
        </Link>

        <p className="admin-nav-label">Recruiter</p>
        <nav aria-label="Company sections">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) => `admin-link ${isActive ? 'is-current' : ''}`}
            >
              {s.label}
              {s.badge === 'invitations' && pending > 0 && (
                <span className="admin-badge" aria-label={`${pending} waiting`}>
                  {pending}
                </span>
              )}
            </NavLink>
          ))}
          {SOON.map((label) => (
            <span key={label} className="admin-link is-soon">
              {label} <em>soon</em>
            </span>
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
