import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api, ApiError } from '../../api/client';

interface Stats {
  colleges: number;
  companies: number;
  verifiedCompanies: number;
  unverifiedCompanies: number;
  users: number;
  students: number;
  frozen: number;
  unverifiedStudents: number;
  batches: number;
  openDrives: number;
  jobs: number;
  publishedJobs: number;
  pendingPostings: number;
  applications: number;
  placed: number;
  pendingInvites: number;
}

const FUNNEL = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'IN_ROUND',
  'OFFERED',
  'ACCEPTED',
  'HIRED',
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnel, setFunnel] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ stats: Stats; funnel: Record<string, number> }>('/admin/stats')
      .then((r) => {
        setStats(r.stats);
        setFunnel(r.funnel);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the overview.'),
      );
  }, []);

  const empty = stats !== null && stats.colleges === 0;

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1>Overview</h1>
          <p className="page-lede">
            {empty
              ? 'Nothing is set up yet. Start by creating a college and inviting its placement officer.'
              : 'Everything on the platform, across every college and company.'}
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {stats && (
        <>
          {/* Anything that needs a human is surfaced before the raw counts. */}
          {(stats.pendingPostings > 0 ||
            stats.unverifiedCompanies > 0 ||
            stats.unverifiedStudents > 0) && (
            <section className="attention">
              <h2>Needs attention</h2>
              <div className="attention-row">
                {stats.unverifiedCompanies > 0 && (
                  <Link to="/admin/companies" className="attention-item">
                    <b>{stats.unverifiedCompanies}</b>
                    <span>
                      {stats.unverifiedCompanies === 1 ? 'company is' : 'companies are'} unverified
                      and cannot publish
                    </span>
                  </Link>
                )}
                {stats.pendingPostings > 0 && (
                  <Link to="/admin/jobs" className="attention-item">
                    <b>{stats.pendingPostings}</b>
                    <span>
                      job {stats.pendingPostings === 1 ? 'request is' : 'requests are'} waiting on a
                      placement cell
                    </span>
                  </Link>
                )}
                {stats.unverifiedStudents > 0 && (
                  <Link to="/admin/students" className="attention-item">
                    <b>{stats.unverifiedStudents}</b>
                    <span>
                      {stats.unverifiedStudents === 1 ? 'student is' : 'students are'} unverified
                      and cannot apply
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}

          <Group
            title="Organisations"
            items={[
              { label: 'Colleges', value: stats.colleges, to: '/admin/colleges' },
              { label: 'Companies', value: stats.companies, to: '/admin/companies' },
              { label: 'Verified companies', value: stats.verifiedCompanies },
            ]}
          />

          <Group
            title="People"
            items={[
              { label: 'Users', value: stats.users, to: '/admin/users' },
              { label: 'Students', value: stats.students, to: '/admin/students' },
              { label: 'Verified students', value: stats.frozen },
              { label: 'Pending invitations', value: stats.pendingInvites, to: '/admin/invites' },
            ]}
          />

          <Group
            title="Placements"
            items={[
              { label: 'Batches', value: stats.batches, to: '/admin/batches' },
              { label: 'Open seasons', value: stats.openDrives, to: '/admin/drives' },
              { label: 'Roles', value: stats.jobs, to: '/admin/jobs' },
              { label: 'Published', value: stats.publishedJobs },
              { label: 'Applications', value: stats.applications, to: '/admin/applications' },
              { label: 'Students placed', value: stats.placed },
            ]}
          />

          {stats.applications > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>The pipeline, platform-wide</h2>
                <Link to="/admin/applications" className="link-btn">
                  See every application
                </Link>
              </div>
              <div className="funnel">
                {FUNNEL.map((k) => (
                  <div key={k} className="funnel-step">
                    <span className="funnel-value">{funnel[k] ?? 0}</span>
                    <span className="funnel-label">{k.replace('_', ' ').toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AdminLayout>
  );
}

function Group({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; to?: string }[];
}) {
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
