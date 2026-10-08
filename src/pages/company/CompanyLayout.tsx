import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import { companyDrivesApi } from '../../api/drives';
import '../admin/AdminLayout.css';
import './Company.css';
import ApliLogo from '../../components/ApliLogo';
import { NAV_ICONS } from '../admin/navIcons';
import { jobApi } from '../../api/jobs';

interface Section {
  to: string;
  label: string;
  end: boolean;
  icon: string;
  needs?: string;
  badge?: 'invitations';
}

/**
 * The sections. The everyday ones sit in one flat list, in the order a
 * recruiter works: roles, the people applying, the colleges, the company.
 * The occasional tools are folded under "More tools" so the list stays short
 * enough to read at a glance.
 */
const MAIN: Section[] = [
  { to: '/company', label: 'Overview', end: true, icon: 'overview' },
  { to: '/company/jobs', label: 'Jobs', end: false, icon: 'jobs', needs: 'job:read' },
  { to: '/company/applicants', label: 'Applicants', end: false, icon: 'applications', needs: 'application:read' },
  { to: '/company/invitations', label: 'Invitations', end: false, icon: 'invites', badge: 'invitations' },
  { to: '/company/institutions', label: 'Colleges', end: false, icon: 'colleges', needs: 'posting:target' },
  { to: '/company/profile', label: 'Company profile', end: false, icon: 'companies', needs: 'company:profile' },
  { to: '/company/team', label: 'Team', end: false, icon: 'users', needs: 'team:manage' },
];

const MORE: Section[] = [
  { to: '/company/assessments', label: 'Assessments', end: false, icon: 'setup', needs: 'application:read' },
  { to: '/company/talent', label: 'Talent', end: false, icon: 'students', needs: 'application:read' },
  { to: '/company/campus-weeks', label: 'Campus weeks', end: false, icon: 'drives', needs: 'job:read' },
  { to: '/company/pools', label: 'Pooled drives', end: false, icon: 'batches', needs: 'posting:target' },
];

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
  const main = MAIN.filter((s) => !s.needs || can(s.needs));
  const more = MORE.filter((s) => !s.needs || can(s.needs));
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // "More tools" opens itself when one of its pages is the one being viewed.
  const inMore = more.some((s) => pathname.startsWith(s.to));
  const [moreOpen, setMoreOpen] = useState(inMore);

  const link = (s: Section) => {
    const Icon = NAV_ICONS[s.icon];
    return (
      <NavLink
        key={s.to}
        to={s.to}
        end={s.end}
        className={({ isActive }) => `admin-link ${isActive ? 'is-current' : ''}`}
      >
        {Icon && <Icon className="admin-link-icon" />}
        <span className="admin-link-text">{s.label}</span>
        {s.badge === 'invitations' && pending > 0 && (
          <span className="admin-badge" aria-label={`${pending} waiting`}>
            {pending}
          </span>
        )}
      </NavLink>
    );
  };

  /** "Post a role", from anywhere: a draft to fill in, as the Jobs page does. */
  const [creating, setCreating] = useState(false);
  async function postRole() {
    setCreating(true);
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);
      const job = await jobApi.create({ title: '', description: 'Describe the role here.', deadline: deadline.toISOString() });
      navigate(`/company/jobs/${job.id}`);
    } catch {
      navigate('/company/jobs');
    } finally {
      setCreating(false);
    }
  }

  async function onSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin co is-company">
      <aside className="admin-nav">
        <Link to="/" className="admin-brand" aria-label="Apli.ai, home">
          <ApliLogo className="brand-logo" />
        </Link>
        <p className="co-portal">Recruiter portal</p>

        <nav aria-label="Company sections" className="co-groups">
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
          {can('job:write') && (
            <button type="button" className="btn btn-primary co-post" onClick={() => void postRole()} disabled={creating}>
              {creating ? 'Starting…' : '+ Post a role'}
            </button>
          )}
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
