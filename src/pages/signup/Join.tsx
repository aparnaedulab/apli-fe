import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import ApliLogo from '../../components/ApliLogo';
import { prefersReducedMotion } from '../../lib/useReveal';
import './signup.css';

/**
 * "Join Apli.ai" - who are you? One door per side, each saying what it costs
 * and what happens when you walk through it, so nobody fills in the wrong
 * form.
 */
const DOORS = [
  {
    to: '/register/student',
    who: 'I am a student',
    line: 'Do work simulations, earn certificates, get invited to apply.',
    note: 'Free, always · ready in a minute',
    tone: 'blue',
    icon: 'student',
  },
  {
    to: '/register/company',
    who: 'I hire for a company',
    line: 'Build a simulation with our team and meet the students who finished it.',
    note: 'Our team verifies every company',
    tone: 'orange',
    icon: 'company',
  },
  {
    to: '/register/institution',
    who: 'I work at a university or college',
    line: 'Bring work simulations to every student, and follow their progress.',
    note: 'Free for your institution',
    tone: 'green',
    icon: 'campus',
  },
] as const;

export default function Join() {
  const [motion] = useState(() => !prefersReducedMotion());

  return (
    <div className={`su su-join ${motion ? 'is-motion' : ''}`}>
      <header className="su-join-top">
        <Link to="/" className="su-brand" aria-label="Apli.ai, home">
          <ApliLogo className="su-brand-logo" />
        </Link>
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </header>

      <main className="su-join-main">
        <div className="su-head is-center">
          <p className="su-eyebrow">Join Apli.ai</p>
          <h1>Who are you joining as?</h1>
        </div>

        <ul className="su-doors">
          {DOORS.map((d, i) => (
            <li key={d.to} style={{ '--i': i } as CSSProperties}>
              <Link to={d.to} className={`su-door is-${d.tone}`}>
                <span className="su-door-icon" aria-hidden="true">
                  <DoorIcon kind={d.icon} />
                </span>
                <b>{d.who}</b>
                <span className="su-door-line">{d.line}</span>
                <span className="su-door-note">{d.note}</span>
                <span className="su-door-go" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

/** Line icons in the portal's style: a cap, an office, a campus. */
function DoorIcon({ kind }: { kind: 'student' | 'company' | 'campus' }) {
  const base = {
    viewBox: '0 0 24 24',
    width: 26,
    height: 26,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'student') {
    return (
      <svg {...base}>
        <path d="m2 9 10-5 10 5-10 5Z" />
        <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
        <path d="M22 9v6" />
      </svg>
    );
  }
  if (kind === 'company') {
    return (
      <svg {...base}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" />
      </svg>
    );
  }
  return (
    <svg {...base}>
      <path d="m3 9 9-5 9 5" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />
    </svg>
  );
}
