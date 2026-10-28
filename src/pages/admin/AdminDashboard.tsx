import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { ApiError } from '../../api/client';
import { studentActivityApi, type AdminStats } from '../../api/studentActivity';

/**
 * The institution at a glance: its students and what they are doing in the
 * student app - work simulations, the internship offers that follow, and
 * interviews.
 */
export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentActivityApi
      .adminStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the overview.'));
  }, []);

  const empty = stats !== null && stats.colleges === 0;
  const sims = stats?.simulations;

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Overview</h1>
          <p className="page-lede">
            {empty
              ? 'Nothing is set up yet. Start by adding your colleges, then invite students.'
              : 'Your students, and what they are doing on Apli.ai.'}
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {stats && sims && (
        <>
          {(sims.inReview > 0 || sims.needsWork > 0 || stats.offers.open > 0) && (
            <section className="attention">
              <h2>Worth a look</h2>
              <div className="attention-row">
                {sims.inReview > 0 && (
                  <Link to="/admin/work?status=IN_REVIEW" className="attention-item">
                    <b>{sims.inReview}</b>
                    <span>
                      {sims.inReview === 1 ? 'simulation is' : 'simulations are'} handed in and waiting for a reviewer
                    </span>
                  </Link>
                )}
                {sims.needsWork > 0 && (
                  <Link to="/admin/work?status=NEEDS_WORK" className="attention-item">
                    <b>{sims.needsWork}</b>
                    <span>
                      {sims.needsWork === 1 ? 'student was' : 'students were'} asked to make changes
                    </span>
                  </Link>
                )}
                {stats.offers.open > 0 && (
                  <Link to="/admin/offers?status=SENT" className="attention-item">
                    <b>{stats.offers.open}</b>
                    <span>
                      internship {stats.offers.open === 1 ? 'offer is' : 'offers are'} waiting on a student&apos;s answer
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}

          <Group
            title="Students"
            items={[
              { label: 'Students', value: stats.students, to: '/admin/students' },
              { label: 'Joined in the last 30 days', value: stats.newStudents },
              { label: 'Active in the last 30 days', value: stats.activeStudents },
              { label: 'Pending invitations', value: stats.pendingInvites, to: '/admin/invites' },
            ]}
          />

          <Group
            title="Work simulations"
            items={[
              { label: 'Live on the platform', value: sims.live, to: '/admin/simulations' },
              { label: 'Started', value: sims.started, to: '/admin/work' },
              { label: 'In progress', value: sims.inProgress },
              { label: 'In review', value: sims.inReview },
              { label: 'Certified', value: sims.certified },
            ]}
          />

          <Group
            title="Internships and interviews"
            items={[
              { label: 'Internship offers', value: stats.offers.sent, to: '/admin/offers' },
              { label: 'Accepted', value: stats.offers.accepted },
              { label: 'Interview invitations', value: stats.interviews.total, to: '/admin/interviews' },
              { label: 'Interviews in progress', value: stats.interviews.open },
            ]}
          />

          {stats.fields.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>What your students are trying</h2>
                <Link to="/admin/simulations" className="link-btn">
                  See every simulation
                </Link>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th className="num">Started</th>
                      <th className="num">Certified</th>
                      <th className="num">Finish rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.fields.map((f) => (
                      <tr key={f.field}>
                        <td>{f.field}</td>
                        <td className="num">{f.started}</td>
                        <td className="num">{f.certified}</td>
                        <td className="num">{f.started ? Math.round((f.certified / f.started) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <Group
            title="Set-up"
            items={[
              { label: 'Colleges', value: stats.colleges, to: '/admin/colleges' },
              { label: 'Batches', value: stats.batches, to: '/admin/batches' },
            ]}
          />
        </>
      )}
    </AdminLayout>
  );
}

function Group({ title, items }: { title: string; items: { label: string; value: number; to?: string }[] }) {
  return (
    <section className="stat-group">
      <h2>{title}</h2>
      <div className="stat-row">
        {items.map((i) =>
          i.to ? (
            <Link key={i.label} to={i.to} className="stat is-link">
              <p className="stat-value">{i.value}</p>
              <p className="stat-label">{i.label}</p>
            </Link>
          ) : (
            <div key={i.label} className="stat">
              <p className="stat-value">{i.value}</p>
              <p className="stat-label">{i.label}</p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
