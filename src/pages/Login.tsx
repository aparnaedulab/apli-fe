import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { homeFor, useAuth } from '../auth/AuthContext';
import { ApliFace } from './student/Apli';
import './Login.css';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Already signed in? Nothing to do here.
  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homeFor(user)} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const signedIn = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homeFor(signedIn), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check that it is running.',
      );
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login-panel">
        <Link to="/" className="login-brand">
          {/* The same lockup the portal's own header carries, so the name
              does not change shape at the moment somebody signs in. */}
          <ApliFace size={26} />
          <span>
            Apli<i>.ai</i>
          </span>
        </Link>

        <h1>Sign in</h1>
        <p className="login-sub">Use the account your college or company set up for you.</p>

        <form onSubmit={onSubmit} noValidate>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span className="field-label">Email</span>
            <input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="you@demo-college.example"
            />
          </label>

          <label className="field">
            <span className="field-label">
              Password
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-foot">
          Colleges and students join by invitation from their placement cell. Hiring?{' '}
          <Link to="/register/company">Register your company</Link>.
        </p>
      </div>

      <aside className="login-aside" aria-hidden="true">
        <blockquote>
          <p>
            Colleges keep one verified roster and decide which companies reach their students.
            Recruiters run their own rounds. Students see only what they qualify for.
          </p>
        </blockquote>
      </aside>
    </div>
  );
}
