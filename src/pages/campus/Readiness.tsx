import { useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { practiceApi, type CollegeReadiness } from '../../api/practice';
import { useAuth } from '../../auth/AuthContext';
import './Readiness.css';

/**
 * How ready the college's students say they are - in totals only.
 *
 * Built to answer "what should our next training session be about?", so the
 * weakest area across the college comes first. It deliberately cannot answer
 * "which students scored lowest": a readiness check people fill in honestly
 * stops being honest the moment it can be used to single them out.
 */
export default function CampusReadiness() {
  const { hasModule, can } = useAuth();
  const enabled = hasModule('dev.readiness') && can('student:read');
  const [data, setData] = useState<CollegeReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    practiceApi
      .college()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load readiness.'));
  }, [enabled]);

  const most = data ? Math.max(1, ...data.distribution.map((d) => d.count)) : 1;

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Readiness</p>
          <h1>How ready your students feel</h1>
          <p className="page-lede">
            {enabled
              ? 'From the readiness check students take for themselves. Totals and averages only - never individual scores.'
              : 'Your institution has not switched on the readiness plan, or your role cannot see students.'}
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {enabled && !data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="stat-row">
            <Stat label="Students" value={data.students} />
            <Stat label="Took the check" value={`${data.checkedPct}%`} />
            <Stat label="Average score" value={data.average ?? '—'} />
          </div>

          {data.checked === 0 ? (
            <section className="card">
              <h2>No checks yet</h2>
              <p className="muted">
                Students find the readiness check under <strong>Readiness</strong> in their menu. It takes two minutes -
                mentioning it in a class group is usually enough to get the first answers in.
              </p>
            </section>
          ) : (
            <div className="crd-grid">
              <section className="card">
                <h2>Where to run a session</h2>
                <p className="muted">Weakest area first, averaged over everyone who took the check.</p>
                <ul className="crd-areas">
                  {data.areas.map((a, i) => (
                    <li key={a.key} className={i === 0 ? 'is-first' : ''}>
                      <span>{a.label}</span>
                      <span className="crd-bar" aria-hidden="true">
                        <span style={{ width: `${a.average ?? 0}%` }} />
                      </span>
                      <strong>{a.average ?? '—'}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <h2>Spread of scores</h2>
                <div className="crd-dist" role="img" aria-label="How many students fall in each score band">
                  {data.distribution.map((d) => (
                    <div key={d.label} className="crd-col">
                      <span className="crd-count">{d.count}</span>
                      <span className="crd-col-bar" style={{ height: `${(d.count / most) * 100}%` }} />
                      <span className="crd-label">{d.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {data.batches.length > 0 && (
            <section className="card">
              <h2>By batch</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Students</th>
                      <th>Took the check</th>
                      <th>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.batches.map((b) => (
                      <tr key={b.name}>
                        <td>{b.name}</td>
                        <td>{b.students}</td>
                        <td>
                          {b.checked} ({b.students ? Math.round((b.checked / b.students) * 100) : 0}%)
                        </td>
                        <td>{b.average ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </CampusLayout>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}
