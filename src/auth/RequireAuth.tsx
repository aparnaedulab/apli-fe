import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuth, type Role } from './AuthContext';

interface RequireAuthProps {
  children: ReactNode;
  /** Omit to allow any signed-in user. */
  roles?: Role[];
  /** The platform console: operations accounts with no institution of their own. */
  platform?: boolean;
}

/**
 * Route guard. Mirrors the server: signed out is a redirect to sign in, and
 * the wrong role is a refusal rather than a redirect - silently bouncing
 * someone to their own dashboard hides the fact that they lack access.
 */
export default function RequireAuth({ children, roles, platform }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-pending" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  if (!user) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if ((roles && !roles.includes(user.role)) || (platform && !user.isPlatform)) {
    return (
      <main className="status-page">
        <p className="eyebrow">Not allowed</p>
        <h1>This area is for a different role.</h1>
        <p className="status-lede">
          You are signed in as {user.fullName}. This part of the platform is not open to your
          account.
        </p>
        <p className="status-back">
          <Link to={homeFor(user)}>← Go to your dashboard</Link>
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
