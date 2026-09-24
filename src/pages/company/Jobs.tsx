import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { jobApi, type JobSummary } from '../../api/jobs';
import { ApiError } from '../../api/client';

const STATUS_PILL: Record<JobSummary['status'], string> = {
  DRAFT: 'pill-idle',
  PUBLISHED: 'pill-pass',
  CLOSED: 'pill-stop',
};

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    jobApi
      .list()
      .then(setJobs)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your roles.'),
      );
  }, []);

  /** A new job starts as a usable draft so the wizard has something to edit. */
  async function startDraft() {
    setCreating(true);
    setError(null);
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);
      const job = await jobApi.create({
        title: '',
        description: 'Describe the role here.',
        deadline: deadline.toISOString(),
      });
      navigate(`/company/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start a draft.');
      setCreating(false);
    }
  }

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Recruiter</p>
          <h1>Roles</h1>
          <p className="page-lede">
            Build a role, define the rounds you will run, and target the colleges you want. Each
            college&rsquo;s placement cell then accepts or declines it.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startDraft} disabled={creating}>
          {creating ? 'Starting…' : 'Post a role'}
        </button>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {jobs === null && !error && <p className="muted">Loading…</p>}

      {jobs?.length === 0 && (
        <div className="empty">
          <h2>No roles yet</h2>
          <p>
            A role carries its own hiring rounds — resume screen, test, interviews — in the order you
            actually run them.
          </p>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Status</th>
                <th className="num">Rounds</th>
                <th>Colleges</th>
                <th className="num">Applicants</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={`/company/jobs/${j.id}`} className="row-link">
                      {j.title}
                    </Link>
                    {j.location && <span className="row-sub">{j.location}</span>}
                  </td>
                  <td>
                    <span className={`pill ${STATUS_PILL[j.status]}`}>{j.status}</span>
                  </td>
                  <td className="num">{j.roundCount}</td>
                  <td>
                    {j.accepted + j.pending + j.declined === 0 ? (
                      <span className="muted">Not targeted</span>
                    ) : (
                      <span className="posting-mix">
                        {j.accepted > 0 && <b className="is-pass">{j.accepted} live</b>}
                        {j.pending > 0 && <b className="is-hold">{j.pending} pending</b>}
                        {j.declined > 0 && <b className="is-stop">{j.declined} declined</b>}
                      </span>
                    )}
                  </td>
                  <td className="num">{j.applicationCount}</td>
                  <td>{new Date(j.deadline).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CompanyLayout>
  );
}
