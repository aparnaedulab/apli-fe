import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ApliLogo from '../../components/ApliLogo';
import { prefersReducedMotion } from '../../lib/useReveal';
import './signup.css';

/**
 * The pieces every sign-up page shares: the split frame, a labelled field,
 * the step bar and the password strength bar. Students, companies and
 * institutions each ask different questions, but they should never feel
 * like three different products.
 */

export function SignupFrame({
  side,
  topRight,
  children,
}: {
  /** The dark half: what the person is joining. Hidden on phones. */
  side: ReactNode;
  topRight: ReactNode;
  children: ReactNode;
}) {
  const [motion] = useState(() => !prefersReducedMotion());

  return (
    <div className={`su ${motion ? 'is-motion' : ''}`}>
      <aside className="su-side" aria-hidden="true">
        <Link to="/" className="su-brand" tabIndex={-1}>
          <ApliLogo className="su-brand-logo" />
        </Link>
        <div className="su-preview">{side}</div>
      </aside>

      <main className="su-main">
        <header className="su-top">
          <Link to="/" className="su-brand su-brand-mobile" aria-label="Apli.ai, home">
            <ApliLogo className="su-brand-logo" />
          </Link>
          <p>{topRight}</p>
        </header>
        {children}
      </main>
    </div>
  );
}

export function Steps({ steps, at }: { steps: readonly string[]; at: number }) {
  return (
    <ol className="su-progress" aria-label="Steps" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => (
        <li key={s} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="su-progress-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`su-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="su-optional">Optional</span>}
      </label>
      {children}
      {error ? (
        <p className="su-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="su-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/** Length is the rule; variety only makes the bar look better. */
export function Strength({ password }: { password: string }) {
  const score = useMemo(() => {
    if (!password) return 0;
    let s = password.length >= 10 ? 2 : 1;
    if (password.length >= 14) s += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) s += 1;
    return Math.min(s, 4);
  }, [password]);
  const label = ['', 'Too short', 'Good', 'Strong', 'Very strong'][score];

  return (
    <span className={`su-strength is-${score}`} aria-live="polite">
      <span className="su-strength-bar">
        {[1, 2, 3, 4].map((n) => (
          <i key={n} className={n <= score ? 'is-on' : ''} />
        ))}
      </span>
      {label && <span className="su-strength-label">{label}</span>}
    </span>
  );
}

/** A password box with Show/Hide and the strength bar under it. */
export function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <span className="su-password">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" onClick={() => setShow((v) => !v)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
      <Strength password={value} />
    </>
  );
}

/** The end of a sign-up: a tick that bursts, a line, and what to do next. */
export function Done({ title, body, children }: { title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <div className="su-welcome" role="status">
      <span className="su-burst" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ ['--i' as string]: i }} />
        ))}
        <b>✓</b>
      </span>
      <h1>{title}</h1>
      <p>{body}</p>
      {children}
    </div>
  );
}

/** Server field errors arrive as "company.gstin" or "contact.email"; forms key on the last part. */
export function fieldErrors(fields: { path: string; message: string }[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields ?? []) out[f.path.split('.').pop() ?? f.path] = f.message;
  return out;
}
