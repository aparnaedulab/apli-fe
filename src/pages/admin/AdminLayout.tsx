import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { studentActivityApi } from '../../api/studentActivity';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PickTenantFirst } from '../../components/TenantSwitcher';
import { AppFrame, type NavItem as FrameItem } from '../student-app/Shell';
import './AdminLayout.css';
import './admin-app.css';

interface NavItem extends FrameItem {
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
 * The admin portal, in the same frame as the student and company apps: one
 * header, the places visited every day across the top, and set-up and
 * people kept in the person's menu.
 *
 * Across the top is what students do in the student app, in the order they
 * do it.
 */
const MAIN: NavItem[] = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/students', label: 'Students', needs: 'student:read' },
  { to: '/admin/simulations', label: 'Simulations', needs: 'student:read' },
  { to: '/admin/work', label: 'Student work', needs: 'student:read' },
  { to: '/admin/offers', label: 'Offers', needs: 'student:read' },
  { to: '/admin/interviews', label: 'Interviews', needs: 'student:read' },
];

const MENU: NavItem[] = [
  { to: '/admin/colleges', label: 'Colleges', needs: 'college:read' },
  { to: '/admin/batches', label: 'Batches', needs: 'batch:read' },
  { to: '/admin/companies', label: 'Companies', needs: 'company:read' },
  { to: '/admin/setup', label: 'Set up', needs: 'college:write' },
  { to: '/admin/map-data', label: 'Map data', needs: 'college:read' },
  { to: '/admin/users', label: 'Users', needs: 'login:manage' },
  { to: '/admin/invites', label: 'Invitations', needs: 'login:manage' },
  { to: '/admin/logins', label: 'Logins', needs: 'login:manage' },
  { to: '/admin/roles', label: 'Role management', needs: 'role:manage' },
  { to: '/admin/settings', label: 'Settings', needs: 'settings:write' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, tenant, can, hasModule } = useAuth();

  const allowed = useCallback(
    (item: NavItem) => (!item.needs || can(item.needs)) && (!item.module || hasModule(item.module)),
    [can, hasModule],
  );
  // What is waiting, counted on the menu: work handed in and not yet reviewed.
  const [inReview, setInReview] = useState(0);
  useEffect(() => {
    if (!tenant || !can('report:read')) return;
    studentActivityApi
      .adminStats()
      .then((s) => setInReview(s.simulations.inReview))
      .catch(() => undefined);
  }, [tenant, can]);

  const nav = useMemo(
    () => MAIN.filter(allowed).map((n) => (n.to === '/admin/work' ? { ...n, badge: inReview } : n)),
    [allowed, inReview],
  );
  const menu = useMemo(() => MENU.filter(allowed), [allowed]);

  // The platform team works inside one institution at a time; say which,
  // and give them the way back to the console.
  const extra = (
    <>
      {user?.isPlatform && (
        <Link to="/platform" className="adm-tenant" title="Back to the platform console">
          <span className="adm-tenant-label">{tenant ? 'In' : 'No institution'}</span>
          {tenant && <b>{tenant.shortName || tenant.name}</b>}
          <span aria-hidden="true">↩</span>
        </Link>
      )}
    </>
  );

  return (
    <AppFrame nav={nav} menu={menu} home="/admin" extra={extra} className="adm">
      <div className="sa-wrap adm-page">{user?.isPlatform && !tenant ? <PickTenantFirst /> : children}</div>
    </AppFrame>
  );
}
