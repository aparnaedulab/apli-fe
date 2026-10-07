import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { publicTenantApi, type PublicTenant } from '../api/publicTenant';
import { homeFor, useAuth } from '../auth/AuthContext';
import ApliLogo from '../components/ApliLogo';
import { applyTenantFavicon, applyTenantTheme, monogram } from '../lib/brand';
import './Login.css';
import './TenantLogin.css';

/**
 * An institution's own sign-in page: /t/<slug>.
 *
 * The same sign-in as /login, dressed in the institution's name, logo and
 * colour, with its Contact us beside it - the address a university prints on
 * its notice board. Who can sign in is not narrowed here: the account decides
 * where it lands, and someone from a different institution is told so rather
 * than quietly sent somewhere unexpected.
 */

type Load =
  | { state: 'loading' }
  | { state: 'ready'; tenant: PublicTenant }
  | { state: 'missing'; message: string };

/** Digits only, for tel: and wa.me links. A leading + is kept for tel:. */
const dial = (v: string) => v.replace(/[^\d+]/g, '');
const whatsapp = (v: string) => v.replace(/\D/g, '');

export default function TenantLogin() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { user, tenant: sessionTenant, loading, login } = useAuth();
  const emailRef = useRef<HTMLInputElement>(null);

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading' });
    publicTenantApi
      .get(slug)
      .then(({ tenant }) => !cancelled && setLoad({ state: 'ready', tenant }))
      .catch((err) => {
        if (cancelled) return;
        setLoad({
          state: 'missing',
          message:
            err instanceof ApiError
              ? err.message
              : 'Could not reach the server. Check your connection and try again.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Paint the page in the institution's colours while it is open, and hand
  // back whatever the session's own institution uses when it closes.
  const sessionBrand = useRef<{ color: string | null; favicon: string | null }>({ color: null, favicon: null });
  sessionBrand.current = { color: sessionTenant?.brandColor ?? null, favicon: sessionTenant?.faviconUrl ?? null };

  const pageTenant = load.state === 'ready' ? load.tenant : null;
  useEffect(() => {
    if (!pageTenant) return;
    applyTenantTheme(pageTenant.brandColor);
    applyTenantFavicon(pageTenant.faviconUrl);
    const previousTitle = document.title;
    document.title = `Sign in · ${pageTenant.name}`;
    return () => {
      applyTenantTheme(sessionBrand.current.color);
      applyTenantFavicon(sessionBrand.current.favicon);
      document.title = previousTitle;
    };
  }, [pageTenant]);

  useEffect(() => {
    if (pageTenant && !user) emailRef.current?.focus();
  }, [pageTenant, user]);

  if (load.state === 'loading' || loading) {
    return (
      <div className="auth-pending" aria-busy="true">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (load.state === 'missing') {
    return (
      <div className="tenant-missing">
        <div className="tenant-missing-card">
          {/* No institution to wear here, so this is Apli's own page and wears
              Apli's own mark. */}
          <ApliLogo className="brand-logo" title="Apli.ai" />
          <h1>Portal not found</h1>
          <p>{load.message}</p>
          <p className="tenant-missing-actions">
            <Link to="/login" className="btn btn-primary">
              Go to the Apli.ai sign-in
            </Link>
            <Link to="/">Home</Link>
          </p>
        </div>
      </div>
    );
  }

  const t = load.tenant;

  // Signed in, whether just now or already. Platform staff and companies are
  // not any one institution's, so they go straight home. Someone who belongs
  // to a different institution is told which one rather than redirected.
  if (user) {
    if (user.isPlatform || !sessionTenant || sessionTenant.slug === t.slug) {
      return <Navigate to={homeFor(user)} replace />;
    }
    return (
      <div className="tenant-missing">
        <div className="tenant-missing-card">
          <h1>You are signed in to {sessionTenant.name}</h1>
          <p>
            Your account belongs to {sessionTenant.name}, not {t.name}. Carry on there, or sign
            out first to use a different account.
          </p>
          <p className="tenant-missing-actions">
            <Link to={homeFor(user)} className="btn btn-primary">
              Go to {sessionTenant.shortName || sessionTenant.name}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      // Where to go is decided by the render above, once the session is in.
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not reach the server. Check that it is running.',
      );
      setPassword('');
      setSubmitting(false);
    }
  }

  const place = [t.address, t.city, t.state, t.pincode].filter(Boolean).join(', ');
  const hasContact = Boolean(
    t.supportEmail || t.supportPhone || t.supportAltPhone || t.supportWhatsapp || t.officeHours || place,
  );

  return (
    <div className="login tenant-login">
      <div className="login-panel">
        <div className="login-brand tenant-brand">
          {t.logoUrl ? (
            <img src={t.logoUrl} alt="" className="tenant-logo" />
          ) : (
            <span className="tenant-monogram" aria-hidden="true">
              {monogram(t.name, t.shortName)}
            </span>
          )}
          <span>{t.name}</span>
        </div>

        <h1>Sign in</h1>
        <p className="login-sub">The {t.shortName || t.name} placement portal.</p>

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
          Students: your placement cell sends your invitation, or shares a batch code to join with.
          Hiring from {t.shortName || t.name}? <Link to="/register/company">Register your company</Link>.
        </p>

        {hasContact && (
          <section className="tenant-contact" aria-labelledby="tenant-contact-title">
            <h2 id="tenant-contact-title">Contact us</h2>
            <dl>
              {t.supportEmail && (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${t.supportEmail}`}>{t.supportEmail}</a>
                  </dd>
                </div>
              )}
              {t.supportPhone && (
                <div>
                  <dt>Phone</dt>
                  <dd>
                    <a href={`tel:${dial(t.supportPhone)}`}>{t.supportPhone}</a>
                    {t.supportAltPhone && (
                      <>
                        {' · '}
                        <a href={`tel:${dial(t.supportAltPhone)}`}>{t.supportAltPhone}</a>
                      </>
                    )}
                  </dd>
                </div>
              )}
              {!t.supportPhone && t.supportAltPhone && (
                <div>
                  <dt>Phone</dt>
                  <dd>
                    <a href={`tel:${dial(t.supportAltPhone)}`}>{t.supportAltPhone}</a>
                  </dd>
                </div>
              )}
              {t.supportWhatsapp && (
                <div>
                  <dt>WhatsApp</dt>
                  <dd>
                    <a href={`https://wa.me/${whatsapp(t.supportWhatsapp)}`} target="_blank" rel="noreferrer">
                      {t.supportWhatsapp}
                    </a>
                  </dd>
                </div>
              )}
              {t.officeHours && (
                <div>
                  <dt>Hours</dt>
                  <dd>{t.officeHours}</dd>
                </div>
              )}
              {place && (
                <div>
                  <dt>Address</dt>
                  <dd>{place}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <p className="tenant-powered">
          Powered by <Link to="/">Apli.ai</Link>
        </p>
      </div>

      <aside className="login-aside" aria-hidden="true">
        <blockquote>
          <p>{t.tagline || `Placements at ${t.name}: one verified roster, every drive in one place.`}</p>
        </blockquote>
      </aside>
    </div>
  );
}
