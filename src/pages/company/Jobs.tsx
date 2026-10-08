import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { EMPLOYMENT_LABELS, WORK_MODE_LABELS, jobApi, type JobSummary } from '../../api/jobs';
import { ApiError } from '../../api/client';

const STATUS_PILL: Record<JobSummary['status'], string> = {
  DRAFT: 'pill-idle',
  PUBLISHED: 'pill-pass',
  CLOSED: 'pill-stop',
};

const STATUS_LABEL: Record<JobSummary['status'], string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Live',
  CLOSED: 'Closed',
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
        <ul className="ecards">
          {jobs.map((j) => {
            const days = Math.ceil((new Date(j.deadline).getTime() - Date.now()) / 86_400_000);
            const targeted = j.accepted + j.pending + j.declined > 0;
            const where = [
              j.location,
              j.workMode ? WORK_MODE_LABELS[j.workMode] ?? j.workMode : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={j.id}>
                <Link to={`/company/jobs/${j.id}`} className={`ecard ${j.status === 'CLOSED' ? 'is-muted' : ''}`}>
                  <span className="ecard-top">
                    <span className="ecard-tag">{EMPLOYMENT_LABELS[j.jobType] ?? j.jobType}</span>
                    <span className={`pill ${STATUS_PILL[j.status]}`}>{STATUS_LABEL[j.status]}</span>
                  </span>
                  <b className="ecard-title">{j.title || 'Untitled role'}</b>
                  {where && <span className="ecard-sub">{where}</span>}
                  <dl className="ecard-facts">
                    <div>
                      <dt>Applicants</dt>
                      <dd>{j.applicationCount}</dd>
                    </div>
                    <div>
                      <dt>Colleges</dt>
                      <dd>
                        {targeted ? `${j.accepted} live${j.pending > 0 ? ` · ${j.pending} waiting` : ''}` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Deadline</dt>
                      <dd className={days >= 0 && days <= 3 ? 'is-soon' : ''}>
                        {new Date(j.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </dd>
                    </div>
                    <div>
                      <dt>Rounds</dt>
                      <dd>{j.roundCount}</dd>
                    </div>
                  </dl>
                  <span className="ecard-foot">
                    <small>
                      {!targeted
                        ? 'Not targeted at any college yet'
                        : j.declined > 0
                          ? `${j.declined} ${j.declined === 1 ? 'college' : 'colleges'} declined`
                          : j.status === 'DRAFT'
                            ? 'Not published yet'
                            : ''}
                    </small>
                    <span className="ecard-go">Open →</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CompanyLayout>
  );
}
