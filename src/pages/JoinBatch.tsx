import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { joinApi, type JoinPreview } from '../api/campus';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import './Login.css';

/**
 * Public self-registration through a batch join link. The second of the two
 * routes into a student account, alongside an emailed invitation.
 */
export default function JoinBatch() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [batch, setBatch] = useState<JoinPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    joinApi
      .preview(code)
      .then((b) => !cancelled && setBatch(b))
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(err instanceof ApiError ? err.message : 'Could not check this join link.');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

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
      await joinApi.accept(code, { fullName, email, password });
      await login(email, password).catch(() => undefined);
      navigate('/student', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
      setSubmitting(false);
    }
  }

  if (previewError) {
    return (
      <main className="status-page">
        <p className="eyebrow">Join link</p>
        <h1>This link will not work.</h1>
        <p className="status-lede">{previewError}</p>
        <p className="status-back">
          <Link to="/login">← Sign in instead</Link>
        </p>
      </main>
    );
  }

  if (!batch) {
    return (
      <div className="auth-pending" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="sr-only">Checking the join link</span>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login-panel">
        <Link to="/" className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Apli.ai</span>
        </Link>

        <h1>Join {batch.batchName}</h1>
        <p className="login-sub">
          <b>{batch.collegeName}</b> · {batch.course}
          {batch.specialisation ? ` (${batch.specialisation})` : ''} · graduating{' '}
          {batch.graduationYear}
        </p>

        <form onSubmit={onSubmit} noValidate>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

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
            <span className="field-label">College email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="you@demo-college.example"
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
            {submitting ? 'Creating your account…' : 'Join this batch'}
          </button>
        </form>

        <p className="login-foot">
          Your college will verify your profile before you can apply for roles.
        </p>
      </div>

      <aside className="login-aside" aria-hidden="true">
        <blockquote>
          <p>One verified profile. Only the roles you actually qualify for.</p>
        </blockquote>
      </aside>
    </div>
  );
}
