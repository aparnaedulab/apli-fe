import { useCallback, useEffect, useState } from 'react';
import CompanyLayout from './CompanyLayout';
import { networkApi, type Pool } from '../../api/network';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import '../student/Alumni.css';
import '../campus/Pools.css';

const TYPE_LABEL = { FINAL: 'Final placements', INTERNSHIP: 'Internships' } as const;

/**
 * Pooled drives, for a recruiter: several colleges running one drive
 * together. Sending a role here puts it in front of every college that has
 * joined - each still accepts or declines it for its own students, exactly as
 * if it had been sent to them one by one.
 */
export default function Pools() {
  const { can } = useAuth();
  const mayTarget = can('posting:target');
  const [data, setData] = useState<{ pools: Pool[]; jobs: { id: string; title: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    networkApi
      .companyPools()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load pooled drives.'));
  }, []);
  useEffect(load, [load]);

  async function send(pool: Pool, jobId: string) {
    setError(null);
    try {
      const r = await networkApi.sendToPool(pool.id, jobId);
      const parts = [
        r.created ? `Sent to ${r.created} college${r.created === 1 ? '' : 's'}` : 'Nothing new to send',
        r.alreadyThere ? `${r.alreadyThere} already had it` : '',
        r.skippedClosed ? `${r.skippedClosed} drive${r.skippedClosed === 1 ? ' is' : 's are'} closed` : '',
        r.needsApproval?.length
          ? `not sent to ${r.needsApproval.join(', ')} - that institution approves companies first (see Institutions)`
          : '',
      ].filter(Boolean);
      setResults((m) => ({ ...m, [pool.id]: `${r.jobTitle}: ${parts.join(' · ')}. Each college will accept or decline it.` }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send that role.');
    }
  }

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Recruiting</p>
          <h1>Pooled drives</h1>
          <p className="page-lede">
            Colleges that have joined up to run one drive together. Send a role once and it reaches all of them; each
            college still decides for its own students.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {data === null ? (
        <p className="muted">Loading…</p>
      ) : data.pools.length === 0 ? (
        <p className="nw-empty">No pooled drives are open right now.</p>
      ) : (
        <div className="pl-grid">
          {data.pools.map((p) => (
            <PoolCard key={p.id} pool={p} jobs={data.jobs} mayTarget={mayTarget} result={results[p.id]} onSend={(jobId) => send(p, jobId)} />
          ))}
        </div>
      )}
    </CompanyLayout>
  );
}

function PoolCard({
  pool,
  jobs,
  mayTarget,
  result,
  onSend,
}: {
  pool: Pool;
  jobs: { id: string; title: string }[];
  mayTarget: boolean;
  result?: string;
  onSend: (jobId: string) => void;
}) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  return (
    <section className="card pl-pool">
      <div className="pl-head">
        <div>
          <h2>{pool.name}</h2>
          <p className="muted">
            {TYPE_LABEL[pool.type]} · {pool.year} · hosted by {pool.hostName}
          </p>
        </div>
        <dl className="pl-stats">
          <div>
            <dt>Colleges</dt>
            <dd>{pool.joined}</dd>
          </div>
          <div>
            <dt>Students</dt>
            <dd>{pool.students.toLocaleString('en-IN')}</dd>
          </div>
        </dl>
      </div>
      <ul className="pl-members">
        {pool.members.map((m) => (
          <li key={m.collegeId}>
            <span>
              <strong>{m.collegeName}</strong>
              <small>{[m.collegeCode, m.city].filter(Boolean).join(' · ')}</small>
            </span>
            <small>{m.students} students</small>
          </li>
        ))}
      </ul>
      {mayTarget &&
        (jobs.length === 0 ? (
          <p className="muted nw-small">Publish a role first - only published, open roles can be sent.</p>
        ) : (
          <div className="pl-send">
            <label className="nw-field">
              <span>Role to send</span>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary" disabled={!jobId} onClick={() => onSend(jobId)}>
              Send to pool
            </button>
          </div>
        ))}
      {result && (
        <p className="alert pl-notice" role="status">
          {result}
        </p>
      )}
    </section>
  );
}
