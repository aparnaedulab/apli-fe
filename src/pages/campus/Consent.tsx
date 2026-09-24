import { useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { CONSENT_EXPLAIN, gapsApi, type ConsentCount } from '../../api/gaps';
import { useAuth } from '../../auth/AuthContext';
import './Consent.css';

/**
 * Where the college's students stand on each thing they were asked to agree to.
 *
 * Totals only, never a list of names: the placement cell needs to know that
 * forty students have not answered the marks question before a drive, not to
 * lean on any one of them. Withdrew and declined are kept apart because they
 * mean different things - a student who said yes and took it back changed
 * their mind, which is worth a conversation about why.
 */
export default function Consent() {
  const { hasModule, can } = useAuth();
  const on = hasModule('compliance.consent');
  const allowed = can('student:read');
  const [rows, setRows] = useState<ConsentCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on || !allowed) return;
    gapsApi
      .consentCounts()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load consent totals.'));
  }, [on, allowed]);

  const head = (lede: string) => (
    <header className="page-head">
      <div>
        <p className="eyebrow">Placement cell</p>
        <h1>Student consent</h1>
        <p className="page-lede">{lede}</p>
      </div>
    </header>
  );

  if (!on) {
    return <CampusLayout>{head('The consent centre is not switched on for your institution.')}</CampusLayout>;
  }
  if (!allowed) {
    return <CampusLayout>{head('Your role does not include reading student records, so these totals are not shown.')}</CampusLayout>;
  }

  const students = rows?.[0]?.students ?? 0;

  return (
    <CampusLayout>
      {head(
        'How many of your students have agreed to each use of their data. Students decide this themselves on their Privacy page; the college cannot answer for them.',
      )}

      {error && <p className="alert alert-error">{error}</p>}

      <section className="card">
        {rows === null ? (
          <p className="muted">Loading…</p>
        ) : students === 0 ? (
          <p className="muted">No students at this college yet.</p>
        ) : (
          <table className="consent-table">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Agreed</th>
                <th>Withdrew</th>
                <th>Declined</th>
                <th>Not answered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.key}>
                  <td>
                    <span className="consent-title">{p.title}</span>
                    {p.neededToApply && <span className="pill pill-hold consent-needed">Needed to apply</span>}
                    <small className="consent-explain">{CONSENT_EXPLAIN[p.key] ?? ''}</small>
                  </td>
                  <td className="num">
                    {p.granted}
                    <small>{pct(p.granted, p.students)}</small>
                  </td>
                  <td className="num">{p.withdrew}</td>
                  <td className="num">{p.declined}</td>
                  <td className={`num ${p.neededToApply && p.neverAnswered > 0 ? 'is-warn' : ''}`}>{p.neverAnswered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {rows && students > 0 && (
        <p className="muted consent-foot">
          Out of {students} students. A student who has not agreed to a purpose marked “Needed to apply” is asked for it the
          first time they apply; nothing is sent to a company until they say yes.
        </p>
      )}
    </CampusLayout>
  );
}

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '');
