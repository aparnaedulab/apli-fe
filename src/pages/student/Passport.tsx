import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import { certificateLink, proofApi, type Claim, type Evidence, type Passport as PassportData } from '../../api/proof';
import { useAuth } from '../../auth/AuthContext';
import './Passport.css';

export const EVIDENCE: Record<Evidence, { label: string; explain: string }> = {
  COLLEGE_VERIFIED: { label: 'College-verified', explain: 'Checked and locked by the placement cell.' },
  EMPLOYER_VERIFIED: { label: 'Employer-verified', explain: 'Work a company reviewed, or a mentor evaluated.' },
  SELF_REPORTED: { label: 'Self-reported', explain: 'Written on the profile. Nobody else has checked it yet.' },
};

const ORDER: Evidence[] = ['COLLEGE_VERIFIED', 'EMPLOYER_VERIFIED', 'SELF_REPORTED'];

/**
 * The claims, grouped by who stands behind them. Shared by the student's own
 * page and the compact view a recruiter sees on an application, so the two
 * can never describe the same claim differently.
 */
export function PassportClaims({ passport, compact = false }: { passport: PassportData; compact?: boolean }) {
  return (
    <div className={`pp ${compact ? 'is-compact' : ''}`}>
      <div className="pp-summary">
        {ORDER.map((e) => (
          <div key={e} className={`pp-tally ev-${e}`}>
            <strong>{countOf(passport, e)}</strong>
            <span>{EVIDENCE[e].label}</span>
          </div>
        ))}
      </div>

      {ORDER.map((e) => {
        const claims = passport.claims.filter((c) => c.evidence === e);
        if (claims.length === 0) return null;
        return (
          <section key={e} className="pp-group">
            <h3>
              <span className={`pp-badge ev-${e}`}>{EVIDENCE[e].label}</span>
              {!compact && <small>{EVIDENCE[e].explain}</small>}
            </h3>
            <ul className="pp-list">
              {claims.map((c, i) => (
                <ClaimRow key={`${c.kind}-${c.label}-${i}`} claim={c} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function countOf(p: PassportData, e: Evidence): number {
  return e === 'COLLEGE_VERIFIED' ? p.summary.collegeVerified : e === 'EMPLOYER_VERIFIED' ? p.summary.employerVerified : p.summary.selfReported;
}

const KIND: Record<Claim['kind'], string> = {
  MARKS: 'Marks',
  SKILL: 'Skill',
  SIMULATION: 'Work simulation',
  INTERNSHIP: 'Internship',
  PROJECT: 'Project',
  EXPERIENCE: 'Experience',
};

function ClaimRow({ claim }: { claim: Claim }) {
  return (
    <li>
      <span className="pp-kind">{KIND[claim.kind]}</span>
      <span className="pp-main">
        <strong>
          {claim.label}
          {claim.detail && <em> · {claim.detail}</em>}
        </strong>
        <small>
          {claim.source}
          {claim.certificateCode && (
            <>
              {' · '}
              <a href={certificateLink(claim.certificateCode)} target="_blank" rel="noreferrer">
                Certificate {claim.certificateCode}
              </a>
            </>
          )}
        </small>
      </span>
    </li>
  );
}

/**
 * /student/passport - every claim on the student's record, labelled by who
 * stands behind it.
 *
 * Nothing here is typed in: the page reads what already happened. The way to
 * move a line from "self-reported" to "verified" is shown beside the counts,
 * because that is the question a student has on seeing them.
 */
export default function Passport() {
  const { hasModule } = useAuth();
  const enabled = hasModule('proof.passport');
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    proofApi
      .passport()
      .then(setPassport)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your passport.'));
  }, [enabled]);

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Skills passport</p>
          <h1>What you can show.</h1>
          <p className="page-lede">
            Recruiters see which lines somebody has vouched for. The more that are verified, the more your profile is
            worth.
          </p>
        </div>
      </header>

      {!enabled ? (
        <p className="alert">The skills passport is not switched on for your institution.</p>
      ) : error ? (
        <p className="alert alert-error">{error}</p>
      ) : !passport ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <section className="card pp-how">
            <h2>Turning claims into proof</h2>
            <ul>
              <li>
                <b>Marks</b> become college-verified once your placement cell checks and locks your record.
              </li>
              <li>
                <b>Skills</b> become employer-verified when you show them in a{' '}
                {hasModule('proof.simulations') ? <Link to="/student/projects">work simulation</Link> : 'work simulation'}.
              </li>
              <li>
                <b>Internships</b> count once your mentor has evaluated you.
              </li>
            </ul>
          </section>
          <section className="card">
            <PassportClaims passport={passport} />
            {passport.claims.length === 0 && (
              <p className="muted">Nothing yet. Fill in your profile, and ask your placement cell to verify your marks.</p>
            )}
          </section>
        </>
      )}
    </StudentLayout>
  );
}
