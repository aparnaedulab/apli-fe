import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import TenantSwitcher, { PickTenantFirst } from '../../components/TenantSwitcher';
import { CollapseIcon, NAV_ICONS } from './navIcons';
import './AdminLayout.css';
import '../company/Company.css';
import ApliLogo from '../../components/ApliLogo';

interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof NAV_ICONS;
  end?: boolean;
  /**
   * The capability this screen needs. Without it the link is not drawn -
   * a menu item that leads to a refusal is worse than no menu item, because
   * it tells somebody they have a job they do not have.
   */
  needs?: string;
  /** Shown only where the institution has this feature switched on. */
  module?: string;
}

/**
 * The sections. What an institution's admins use day to day sits in one short
 * flat list; set-up, configuration and records are folded under "More tools",
 * which opens itself on any of its pages. The same shape as the college and
 * recruiter portals.
 */
const MAIN: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: 'overview', end: true },
  { to: '/admin/colleges', label: 'Colleges', icon: 'colleges', needs: 'college:read' },
  { to: '/admin/companies', label: 'Companies', icon: 'companies', needs: 'company:read' },
  { to: '/admin/students', label: 'Students', icon: 'students', needs: 'student:read' },
  { to: '/admin/batches', label: 'Batches', icon: 'batches', needs: 'batch:read' },
  { to: '/admin/drives', label: 'Placement seasons', icon: 'drives', needs: 'drive:read' },
  { to: '/admin/jobs', label: 'Jobs', icon: 'jobs', needs: 'job:read' },
  { to: '/admin/applications', label: 'Applications', icon: 'applications', needs: 'application:read' },
  { to: '/admin/reports', label: 'Reports', icon: 'audit', needs: 'report:read', module: 'compliance.reports' },
];

const MORE: NavItem[] = [
  // Counts live on Overview; this is the same platform read as movement.
  { to: '/admin/pulse', label: 'Activity', icon: 'overview', needs: 'report:read' },
  { to: '/admin/notices', label: 'Notices', icon: 'invites', needs: 'settings:write' },
  { to: '/admin/setup', label: 'Set up', icon: 'setup', needs: 'college:write' },
  { to: '/admin/map-data', label: 'Map data', icon: 'batches', needs: 'college:read' },
  { to: '/admin/company-access', label: 'Company access', icon: 'companies', needs: 'company:verify' },
  { to: '/admin/users', label: 'Users', icon: 'users', needs: 'login:manage' },
  { to: '/admin/invites', label: 'Invitations', icon: 'invites', needs: 'login:manage' },
  // What students practise with - the institution's own, from the built-in set.
  { to: '/admin/interview-questions', label: 'Interview questions', icon: 'jobs', needs: 'college:read', module: 'dev.mockInterview' },
  { to: '/admin/skill-demand', label: 'Skill demand', icon: 'jobs', needs: 'report:read', module: 'ops.skillHeatmap' },
  { to: '/admin/audit', label: 'Audit trail', icon: 'audit', needs: 'audit:read' },
  { to: '/admin/logins', label: 'Logins', icon: 'logins', needs: 'login:manage' },
  { to: '/admin/roles', label: 'Role management', icon: 'roles', needs: 'role:manage' },
  { to: '/admin/institution-rules', label: 'Placement rules', icon: 'settings', needs: 'college:read' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings', needs: 'settings:write' },
];

const STORAGE_KEY = 'admin.nav.collapsed';

/**
 * Remembered per browser, because whether the rail is open is a working
 * preference rather than something to re-decide on every page load. A browser
 * that refuses storage just gets the expanded default.
 */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, tenant, logout, can, hasModule } = useAuth();

  /*
   * The sidebar is built from what this role may actually reach. A group
   * whose every item was filtered out drops its heading too, so nobody is
   * left staring at an empty "Configuration".
   */
  const allowed = useCallback(
    (item: NavItem) => (!item.needs || can(item.needs)) && (!item.module || hasModule(item.module)),
    [can, hasModule],
  );
  const main = useMemo(() => MAIN.filter(allowed), [allowed]);
  const more = useMemo(() => MORE.filter(allowed), [allowed]);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(() => MORE.some((m) => pathname.startsWith(m.to)));
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Not worth failing a click over.
      }
      return next;
    });
  }, []);

  // "[" toggles the rail, the same key most editors use for it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement;
      if (e.key === '[' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const link = (item: NavItem) => {
    const Icon = NAV_ICONS[item.icon]!;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        // The label is the tooltip once it is no longer on screen.
        title={collapsed ? item.label : undefined}
        className={({ isActive }) => `admin-link ${isActive ? 'is-current' : ''}`}
      >
        <Icon className="admin-link-icon" />
        <span className="admin-link-text">{item.label}</span>
      </NavLink>
    );
  };

  async function onSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={`admin co ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="admin-nav">
        <div className="admin-nav-head">
          <Link to="/" className="admin-brand" aria-label="Apli.ai, home">
            {/* The real mark, not the placeholder square it used to be. */}
            <ApliLogo className="brand-logo" />
          </Link>
          <button
            type="button"
            className="admin-collapse"
            onClick={toggle}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
            title={`${collapsed ? 'Expand' : 'Collapse'} sidebar  [`}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>

        <TenantSwitcher collapsed={collapsed} />

        <nav aria-label="Admin sections" className="admin-groups co-groups">
          {main.map(link)}

          {more.length > 0 && (
            <>
              <button
                type="button"
                className={`admin-link co-more ${moreOpen ? 'is-open' : ''}`}
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                title={collapsed ? 'More tools' : undefined}
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
          <div className="admin-user-who">
            <p className="admin-user-name">{user?.fullName}</p>
            <p className="admin-user-email">{user?.email}</p>
          </div>
          <button
            type="button"
            className="admin-signout"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <span className="admin-signout-text">Sign out</span>
            <svg
              className="admin-signout-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
              <path d="M10 8 6 12l4 4M6 12h10" />
            </svg>
          </button>
        </div>
      </aside>

      {/* The platform team standing in no institution has nothing to look at
          here yet: every screen below is one institution's rows. */}
      <main className="admin-main">
        <div className="admin-topbar">
          <NotificationBell />
        </div>
        {user?.isPlatform && !tenant ? <PickTenantFirst /> : children}
      </main>
    </div>
  );
}
