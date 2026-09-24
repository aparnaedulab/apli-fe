import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { campusApi, type CampusOverview } from '../../api/campus';
import { ApiError } from '../../api/client';
import GettingStarted from './GettingStarted';
import WaitingOnCompanies from './WaitingOnCompanies';
import NoticeBoard from '../../components/NoticeBoard';

export default function CampusDashboard() {
  const [data, setData] = useState<CampusOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    campusApi
      .overview()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the overview.'),
      );
  }, []);

  const s = data?.stats;
  const noBatches = s?.batches === 0;

  return (
    <CampusLayout>
      <NoticeBoard />
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>{data?.college?.name ?? 'Overview'}</h1>
          <p className="page-lede">
            {noBatches
              ? 'Start by creating a batch and inviting its students. Everything else builds on the roster.'
              : 'Your roster and the season at a glance.'}
          </p>
        </div>
        <Link to="/campus/batches" className="btn btn-primary">
          Manage batches
        </Link>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {s && <GettingStarted stats={s} />}

      <WaitingOnCompanies />

      <div className="stat-row">
        <Stat label="Batches" value={s?.batches} />
        <Stat label="Students" value={s?.students} />
        <Stat label="Verified" value={s?.frozen} />
        <Stat label="Not yet verified" value={s?.unverified} />
        <Stat label="Pending invites" value={s?.pendingInvites} />
      </div>

      {s && s.pendingPostings > 0 && (
        <p className="alert alert-warn">
          <b>
            {s.pendingPostings} job request{s.pendingPostings === 1 ? '' : 's'} waiting on you.
          </b>{' '}
          Companies cannot reach your students until you accept.{' '}
          <Link to="/campus/requests">Review them →</Link>
        </p>
      )}

      {s && s.unverified > 0 && (
        <p className="alert alert-warn">
          {s.unverified} student{s.unverified === 1 ? '' : 's'} still need verifying. A student
          cannot apply for anything until you check their record and freeze it.
        </p>
      )}

    </CampusLayout>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="stat">
      <p className="stat-value">{value ?? '—'}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}
