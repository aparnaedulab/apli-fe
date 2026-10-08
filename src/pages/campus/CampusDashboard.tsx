import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { campusApi, type CampusOverview } from '../../api/campus';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import GettingStarted from './GettingStarted';
import WaitingOnCompanies from './WaitingOnCompanies';
import NoticeBoard from '../../components/NoticeBoard';

/**
 * The placement cell's overview, in the same shapes as the recruiter's: a
 * compact head, four numbers that each open their page, then what needs the
 * officer's attention on the left and where the roster stands on the right.
 */

function partOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CampusDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<CampusOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    campusApi
      .overview()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the overview.'));
  }, []);

  const s = data?.stats;
  const first = user?.fullName?.split(' ').find((w) => !/^(dr|prof|mr|ms|mrs)\.?$/i.test(w)) ?? '';
  const verifiedPct = s && s.students > 0 ? Math.round((s.frozen / s.students) * 100) : 0;

  /* What is waiting on the placement cell, most urgent first. */
  const todo = s
    ? [
        s.pendingPostings > 0 && {
          key: 'requests',
          title: `${s.pendingPostings} job request${s.pendingPostings === 1 ? '' : 's'} to review`,
          body: 'Companies cannot reach your students until you accept.',
          to: '/campus/requests',
          cta: 'Review',
        },
        s.unverified > 0 && {
          key: 'verify',
          title: `${s.unverified} student${s.unverified === 1 ? '' : 's'} to verify`,
          body: 'A student cannot apply for anything until you check and freeze their record.',
          to: '/campus/batches',
          cta: 'Verify',
        },
        s.pendingInvites > 0 && {
          key: 'invites',
          title: `${s.pendingInvites} student invitation${s.pendingInvites === 1 ? '' : 's'} not accepted yet`,
          body: 'They have not signed in yet. You can resend from the batch.',
          to: '/campus/batches',
          cta: 'Open batches',
        },
      ].filter((x): x is { key: string; title: string; body: string; to: string; cta: string } => Boolean(x))
    : [];

  return (
    <CampusLayout>
      <NoticeBoard />

      <header className="cd-head">
        <div>
          <p className="cd-when">
            {partOfDay()}
            {first ? `, ${first}` : ''}
          </p>
          <h1>
            {data?.college?.name ?? 'Overview'}
            {data?.college?.city && <span className="cd-badge is-ok">{data.college.city}</span>}
          </h1>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {s && (
        <>
          {/* Four numbers, each opening its page. */}
          <div className="cd-stats">
            <Link to="/campus/programs" className="cd-stat">
              <b>{s.students}</b>
              <span>Students</span>
              <small>
                in {s.batches} batch{s.batches === 1 ? '' : 'es'}
              </small>
            </Link>
            <Link to="/campus/batches" className={`cd-stat ${s.unverified > 0 ? 'is-hot' : ''}`}>
              <b>{s.unverified}</b>
              <span>To verify</span>
              <small>{s.frozen} verified</small>
            </Link>
            <Link to="/campus/requests" className={`cd-stat ${s.pendingPostings > 0 ? 'is-hot' : ''}`}>
              <b>{s.pendingPostings}</b>
              <span>Job requests</span>
              <small>{s.pendingPostings > 0 ? 'waiting for you' : 'none waiting'}</small>
            </Link>
            <Link to="/campus/requests" className="cd-stat">
              <b>{s.acceptedPostings}</b>
              <span>Live roles</span>
              <small>
                in {s.drives} season{s.drives === 1 ? '' : 's'}
              </small>
            </Link>
          </div>

          <div className="cd-cols">
            <div className="cd-main">
              <section className="cd-panel">
                <header className="cd-panel-head">
                  <h2>Needs your attention</h2>
                </header>
                {todo.length === 0 ? (
                  <p className="cd-empty">Nothing is waiting on you. New job requests and students to verify show up here.</p>
                ) : (
                  <ul className="cc-todo">
                    {todo.map((t) => (
                      <li key={t.key}>
                        <span className="cc-todo-text">
                          <b>{t.title}</b>
                          <small>{t.body}</small>
                        </span>
                        <Link to={t.to} className="btn btn-primary btn-sm">
                          {t.cta}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <WaitingOnCompanies />
            </div>

            <aside className="cd-side">
              <section className="cd-panel">
                <header className="cd-panel-head">
                  <h2>Your roster</h2>
                  <Link to="/campus/batches">Batches →</Link>
                </header>
                <div className="cc-ring-row">
                  <span className="cc-ring" style={{ '--p': `${verifiedPct}%` } as React.CSSProperties}>
                    <b>{verifiedPct}%</b>
                  </span>
                  <span>
                    <b>{s.frozen} of {s.students} verified</b>
                    <small>Only verified students can apply.</small>
                  </span>
                </div>
              </section>

              <GettingStarted stats={s} />
            </aside>
          </div>
        </>
      )}
    </CampusLayout>
  );
}
