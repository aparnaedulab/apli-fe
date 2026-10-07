import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { companyAdminApi } from '../../api/admin';
import ApliLogo from '../../components/ApliLogo';

/**
 * The console's top bar: the two things the platform team looks after -
 * universities and companies - and who is signed in.
 *
 * The Companies tab carries the number waiting for review, because a company
 * nobody has verified cannot post a single job anywhere on the platform.
 */
export default function ConsoleHeader() {
  const { user, tenant: acting, logout } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    companyAdminApi
      .list('PENDING')
      .then((r) => setPending(r.counts.PENDING ?? 0))
      .catch(() => setPending(null));
  }, []);

  return (
    <header className="console-top">
      <div className="console-brand">
        <ApliLogo className="brand-logo" title="Apli.ai" />
        <span>
          <small>Platform console</small>
        </span>
      </div>

      <nav className="console-nav" aria-label="Console sections">
        <NavLink to="/platform" end className={({ isActive }) => (isActive ? 'is-on' : '')}>
          Universities
        </NavLink>
        <NavLink to="/platform/companies" className={({ isActive }) => (isActive ? 'is-on' : '')}>
          Companies
          {pending ? <span className="console-badge">{pending}</span> : null}
        </NavLink>
      </nav>

      <div className="console-me">
        {acting && (
          <>
            {/* Straight to the activity read of whichever university is being
                acted on, without going through its dashboard first. */}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/admin/pulse')}
            >
              Activity
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin')}>
              In {acting.shortName || acting.name} →
            </button>
          </>
        )}
        <span className="console-who">{user?.fullName}</span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
