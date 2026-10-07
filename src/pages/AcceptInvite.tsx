import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { inviteApi, type InvitePreview } from '../api/admin';
import { ApiError } from '../api/client';
import { HOME_FOR, homeFor, useAuth, type Role } from '../auth/AuthContext';
import './Login.css';
import ApliLogo from '../components/ApliLogo';

const ROLE_LABEL: Record<InvitePreview['role'], string> = {
  CAMPUS: 'placement team',
  COMPANY: 'recruiting team',
  CANDIDATE: 'student',
};

/**
 * Public. This is what "sign up" means on this platform - there is no open
 * registration form, only invitations that already know who you are and what
 * organisation you are joining.
 */
export default function AcceptInvite() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    inviteApi
      .preview(token)
      .then((p) => {
        if (cancelled) return;
        setInvite(p);
        setFullName(p.invitedName ?? '');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(
          err instanceof ApiError ? err.message : 'Could not check this invitation link.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const { user } = await inviteApi.accept(token, { fullName, password });
      // Accepting signs them in server-side; refresh the client's copy.
      const signedIn = await login(invite!.email, password).catch(() => null);
      navigate(signedIn ? homeFor(signedIn) : (HOME_FOR[user.role as Role] ?? '/'), {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
      setSubmitting(false);
    }
  }

  if (previewError) {
    return (
      <main className="status-page">
        <p className="eyebrow">Invitation</p>
        <h1>This link will not work.</h1>
        <p className="status-lede">{previewError}</p>
        <p className="status-back">
          <Link to="/login">← Sign in instead</Link>
        </p>
      </main>
    );
  }

  if (!invite) {
    return (
      <div className="auth-pending" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="sr-only">Checking your invitation</span>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login-panel">
        <Link to="/" className="login-brand" aria-label="Apli.ai, home">
          <ApliLogo className="brand-logo" />
        </Link>

        <h1>Set up your account</h1>
        <p className="login-sub">
          {invite.organisation ? (
            <>
              You have been invited to join <b>{invite.organisation}</b> as part of its{' '}
              {ROLE_LABEL[invite.role]}.
            </>
          ) : (
            <>You have been invited to join Apli.ai.</>
          )}
        </p>

        <form onSubmit={onSubmit} noValidate>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span className="field-label">Email</span>
            <input value={invite.email} readOnly disabled className="mono" />
          </label>

          <label className="field">
            <span className="field-label">Your full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
              disabled={submitting}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Choose a password
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              disabled={submitting}
              placeholder="At least 10 characters"
            />
          </label>

          <label className="field">
            <span className="field-label">Confirm password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              disabled={submitting}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating your account…' : 'Create account'}
          </button>
        </form>

        <p className="login-foot">
          This invitation can be used once, and expires on{' '}
          {new Date(invite.expiresAt).toLocaleDateString()}.
        </p>
      </div>

      <aside className="login-aside" aria-hidden="true">
        <blockquote>
          <p>
            Your college keeps one verified roster and decides which companies reach its students.
          </p>
        </blockquote>
      </aside>
    </div>
  );
}
