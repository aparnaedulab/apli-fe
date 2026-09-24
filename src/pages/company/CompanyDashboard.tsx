import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { companyApi, type CompanyOverview } from '../../api/company';
import { ApiError } from '../../api/client';
import NoticeBoard from '../../components/NoticeBoard';

export default function CompanyDashboard() {
  const [data, setData] = useState<CompanyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companyApi
      .overview()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the overview.'),
      );
  }, []);

  const c = data?.company;
  const isOwner = data?.myRole === 'OWNER';

  return (
    <CompanyLayout>
      <NoticeBoard />
      <header className="page-head">
        <div>
          <p className="eyebrow">Recruiter</p>
          <h1>{c?.name ?? 'Overview'}</h1>
          <p className="page-lede">
            {c?.isVerified
              ? 'Verified. You can publish roles to the colleges you target.'
              : (c?.statusNote ?? 'Awaiting verification before you can publish roles.')}
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {/*
        Say where they stand in the words that match their actual state.
        A rejected company being told it is "awaiting verification" would wait
        forever for something that is not coming.
      */}
      {c && c.status === 'PENDING' && (
        <p className="alert alert-warn">
          <b>Waiting to be verified.</b> Set up your team and draft your roles now — publishing
          opens as soon as the university reviews you. Filling in your registered name and GSTIN
          makes that quicker.
        </p>
      )}

      {c && c.status === 'REJECTED' && (
        <p className="alert alert-error">
          <b>Your registration was not approved.</b>
          {c.rejectionReason ? ` ${c.rejectionReason}` : ''} Update your profile and contact the
          placement office if you think this is a mistake.
        </p>
      )}

      {c && c.status === 'SUSPENDED' && (
        <p className="alert alert-error">
          <b>Your company is suspended.</b>
          {c.rejectionReason ? ` ${c.rejectionReason}` : ''} Published roles are hidden and no new
          ones can be posted.
        </p>
      )}

      {data && (
        <>
          <div className="stat-row">
            <Stat label="Jobs" value={data.stats.jobs} />
            <Stat label="Published" value={data.stats.published} />
            <Stat label="Drafts" value={data.stats.drafts} />
            <Stat label="Applicants" value={data.stats.applications} />
            <Stat label="Pending invites" value={data.stats.pendingInvites} />
          </div>

          {data.stats.applications > 0 && (
            <section className="card">
              <h2>Your pipeline</h2>
              <p className="muted">Where every applicant across your roles currently stands.</p>
              <div className="funnel">
                {[
                  'APPLIED',
                  'UNDER_REVIEW',
                  'SHORTLISTED',
                  'IN_ROUND',
                  'OFFERED',
                  'ACCEPTED',
                  'HIRED',
                ].map((k) => (
                  <div key={k} className="funnel-step">
                    <span className="funnel-value">{data.funnel[k] ?? 0}</span>
                    <span className="funnel-label">{k.replace('_', ' ').toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Edited on one screen now, beside the preview of what it does,
              rather than as a second copy of the same fields here. */}
          {isOwner && c && (
            <section className="card">
              <h2>Company profile</h2>
              <p className="muted">
                Your pictures, your words and your facts — this is what students read before they
                apply.
              </p>
              <Link to="/company/profile" className="btn btn-secondary">
                Edit your profile
              </Link>
            </section>
          )}

          <section className="card">
            <h2>What comes next</h2>
            <ol className="next-list">
              <li>
                <b>Build your team</b>
                Add the recruiters and interviewers who will run your hiring.
              </li>
              <li>
                <b>Post a role</b>
                Job details, eligibility criteria, and the rounds you will actually run.
              </li>
              <li>
                <b>Target colleges</b>
                Each college&rsquo;s placement cell accepts or declines your posting before its
                students see it.
              </li>
            </ol>
          </section>
        </>
      )}
    </CompanyLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}
