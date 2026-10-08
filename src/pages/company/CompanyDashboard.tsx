import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { companyApi, type CompanyOverview } from '../../api/company';
import { jobApi, type JobSummary } from '../../api/jobs';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import NoticeBoard from '../../components/NoticeBoard';

/**
 * The recruiter's overview.
 *
 * A compact head with the company's standing, four numbers that each open
 * their page, then two columns: the roles and where applicants stand on the
 * left, and on the right what is left to set up and anything waiting on the
 * recruiter (campus invitations). The same shapes as the student portal.
 */

/** The pipeline, as stages a recruiter reads left to right. */
const STAGES: { key: string; label: string }[] = [
  { key: 'APPLIED', label: 'Applied' },
  { key: 'UNDER_REVIEW', label: 'In review' },
  { key: 'SHORTLISTED', label: 'Shortlisted' },
  { key: 'IN_ROUND', label: 'In rounds' },
  { key: 'OFFERED', label: 'Offered' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'HIRED', label: 'Hired' },
];

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', PUBLISHED: 'Live', CLOSED: 'Closed' };

function partOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function CompanyDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<CompanyOverview | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companyApi
      .overview()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the overview.'));
    jobApi
      .list()
      .then(setJobs)
      .catch(() => setJobs([]));
  }, []);

  const c = data?.company;
  const isOwner = data?.myRole === 'OWNER';
  const first = user?.fullName?.split(' ')[0] ?? '';

  /* Live roles first, then drafts; the closed ones are history. */
  const roles = (jobs ?? [])
    .filter((j) => j.status !== 'CLOSED')
    .sort((a, b) => (a.status === b.status ? a.deadline.localeCompare(b.deadline) : a.status === 'PUBLISHED' ? -1 : 1))
    .slice(0, 6);

  const funnelMax = Math.max(1, ...STAGES.map((s) => data?.funnel[s.key] ?? 0));

  /* What is left to set up, in the order it unlocks hiring. */
  const steps = data
    ? [
        { done: Boolean(c?.isVerified), label: 'Get verified', hint: 'The university checks your company once.', to: '/company/profile' },
        { done: Boolean(c?.about || c?.headline), label: 'Fill in your company profile', hint: 'What students read before they apply.', to: '/company/profile' },
        { done: data.stats.jobs > 0, label: 'Draft your first role', hint: 'Details, eligibility and the rounds you run.', to: '/company/jobs' },
        { done: data.stats.published > 0, label: 'Publish to colleges', hint: 'Each placement cell accepts it before students see it.', to: '/company/jobs' },
      ]
    : [];
  const left = steps.filter((s) => !s.done).length;

  return (
    <CompanyLayout>
      <NoticeBoard />

      <header className="cd-head">
        <div>
          <p className="cd-when">{partOfDay()}{first ? `, ${first}` : ''}</p>
          <h1>
            {c?.name ?? 'Overview'}
            {c && (
              <span className={`cd-badge ${c.isVerified ? 'is-ok' : c.status === 'PENDING' ? 'is-wait' : 'is-stop'}`}>
                {c.isVerified ? '✓ Verified' : c.status === 'PENDING' ? 'Awaiting verification' : c.status === 'REJECTED' ? 'Not approved' : 'Suspended'}
              </span>
            )}
          </h1>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {/* Where they stand, in words that match their actual state. */}
      {c && c.status === 'PENDING' && (
        <p className="alert alert-warn">
          <b>Waiting to be verified.</b> Set up your team and draft your roles now - publishing opens as soon as the
          university reviews you. Filling in your registered name and GSTIN makes that quicker.
        </p>
      )}
      {c && c.status === 'REJECTED' && (
        <p className="alert alert-error">
          <b>Your registration was not approved.</b>
          {c.rejectionReason ? ` ${c.rejectionReason}` : ''} Update your profile and contact the placement office if you
          think this is a mistake.
        </p>
      )}
      {c && c.status === 'SUSPENDED' && (
        <p className="alert alert-error">
          <b>Your company is suspended.</b>
          {c.rejectionReason ? ` ${c.rejectionReason}` : ''} Published roles are hidden and no new ones can be posted.
        </p>
      )}

      {data && (
        <>
          {/* Four numbers, each opening its page. */}
          <div className="cd-stats">
            <Link to="/company/jobs" className="cd-stat">
              <b>{data.stats.published}</b>
              <span>Live roles</span>
              <small>{data.stats.drafts} draft{data.stats.drafts === 1 ? '' : 's'}</small>
            </Link>
            <Link to="/company/applicants" className="cd-stat">
              <b>{data.stats.applications}</b>
              <span>Applicants</span>
              <small>across all roles</small>
            </Link>
            <Link to="/company/applicants" className="cd-stat">
              <b>{(data.funnel.OFFERED ?? 0) + (data.funnel.ACCEPTED ?? 0) + (data.funnel.HIRED ?? 0)}</b>
              <span>Offers made</span>
              <small>{data.funnel.HIRED ?? 0} hired</small>
            </Link>
            <Link to="/company/invitations" className={`cd-stat ${data.stats.pendingInvites > 0 ? 'is-hot' : ''}`}>
              <b>{data.stats.pendingInvites}</b>
              <span>Campus invitations</span>
              <small>{data.stats.pendingInvites > 0 ? 'waiting for your answer' : 'none waiting'}</small>
            </Link>
          </div>

          <div className="cd-cols">
            <div className="cd-main">
              {/* Roles */}
              <section className="cd-panel">
                <header className="cd-panel-head">
                  <h2>Your roles</h2>
                  <Link to="/company/jobs">All roles →</Link>
                </header>
                {jobs === null ? (
                  <p className="muted">Loading…</p>
                ) : roles.length === 0 ? (
                  <p className="cd-empty">No roles yet. Use “+ Post a role” at the top to draft your first.</p>
                ) : (
                  <ul className="cd-roles">
                    {roles.map((j) => {
                      const d = daysTo(j.deadline);
                      return (
                        <li key={j.id}>
                          <Link to={`/company/jobs/${j.id}`}>
                            <span className="cd-role-main">
                              <b>{j.title || 'Untitled role'}</b>
                              <small>
                                {[j.location, j.status === 'PUBLISHED' ? `${j.accepted} college${j.accepted === 1 ? '' : 's'} live` : null, j.pending ? `${j.pending} waiting for approval` : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </small>
                            </span>
                            <span className="cd-role-apps">
                              <b>{j.applicationCount}</b>
                              <small>applicants</small>
                            </span>
                            <span className={`cd-role-status is-${j.status.toLowerCase()}`}>{STATUS_LABEL[j.status] ?? j.status}</span>
                            <span className={`cd-role-due ${d <= 3 ? 'is-soon' : ''}`}>
                              {d < 0 ? 'Closed' : d === 0 ? 'Closes today' : `${d}d left`}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Pipeline */}
              {data.stats.applications > 0 && (
                <section className="cd-panel">
                  <header className="cd-panel-head">
                    <h2>Pipeline</h2>
                    <Link to="/company/applicants">Applicants →</Link>
                  </header>
                  <ol className="cd-funnel">
                    {STAGES.map((st) => {
                      const n = data.funnel[st.key] ?? 0;
                      return (
                        <li key={st.key}>
                          <span className="cd-funnel-label">{st.label}</span>
                          <span className="cd-funnel-bar" aria-hidden="true">
                            <i style={{ width: `${(n / funnelMax) * 100}%` }} />
                          </span>
                          <b>{n}</b>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}
            </div>

            <aside className="cd-side">
              {/* Set up - only while something is left. */}
              {left > 0 && (
                <section className="cd-panel">
                  <header className="cd-panel-head">
                    <h2>Get set up</h2>
                    <span className="cd-left">{left} left</span>
                  </header>
                  <ol className="cd-steps">
                    {steps.map((s) => (
                      <li key={s.label} className={s.done ? 'is-done' : ''}>
                        <Link to={s.to}>
                          <span className="cd-step-mark" aria-hidden="true">
                            {s.done ? '✓' : ''}
                          </span>
                          <span>
                            <b>{s.label}</b>
                            {!s.done && <small>{s.hint}</small>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {data.stats.pendingInvites > 0 && (
                <Link to="/company/invitations" className="cd-invite">
                  <b>
                    {data.stats.pendingInvites} college{data.stats.pendingInvites === 1 ? ' has' : 's have'} invited you
                  </b>
                  <small>Answer before their drive dates fill up →</small>
                </Link>
              )}

              {isOwner && (
                <section className="cd-panel">
                  <header className="cd-panel-head">
                    <h2>Your team</h2>
                  </header>
                  <p className="cd-note">Add the recruiters and interviewers who run your hiring with you.</p>
                  <Link to="/company/team" className="btn btn-secondary btn-sm">
                    Manage team
                  </Link>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </CompanyLayout>
  );
}
