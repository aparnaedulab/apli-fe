import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { platformApi, type TenantCard, type TenantStatus } from '../../api/platform';
import { useAuth } from '../../auth/AuthContext';
import { lightTokens, monogram } from '../../lib/brand';
import ConsoleHeader from './ConsoleHeader';
import './Platform.css';

const STEP_TOTAL = 7;

const FILTERS: { key: TenantStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Onboarding' },
  { key: 'ACTIVE', label: 'Live' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

const KIND_LABEL = { UNIVERSITY: 'University', COLLEGE: 'College', GROUP: 'Group' } as const;

/**
 * The platform team's home: every university, and the one next thing to do
 * with each.
 *
 * A draft shows how far its onboarding got and a button to carry on; a live
 * one shows its size and a button to step inside. Nothing here needs to be
 * learnt - every card says what it is and offers one obvious action.
 */
export default function Console() {
  const { tenant: acting, actAs } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TenantStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    platformApi
      .tenants()
      .then((r) => setTenants(r.tenants))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load universities.'));
  }, []);

  const counts = useMemo(() => {
    const c = { ALL: 0, DRAFT: 0, ACTIVE: 0, SUSPENDED: 0 } as Record<TenantStatus | 'ALL', number>;
    tenants?.forEach((t) => {
      c.ALL++;
      c[t.status]++;
    });
    return c;
  }, [tenants]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tenants ?? [])
      .filter((t) => filter === 'ALL' || t.status === filter)
      .filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          (t.shortName ?? '').toLowerCase().includes(q) ||
          (t.city ?? '').toLowerCase().includes(q),
      );
  }, [tenants, filter, query]);

  const totals = useMemo(
    () =>
      (tenants ?? []).reduce(
        (a, t) => ({ colleges: a.colleges + t.colleges, students: a.students + t.students }),
        { colleges: 0, students: 0 },
      ),
    [tenants],
  );

  /**
   * Step into a university and land somewhere inside it.
   *
   * Acting as the tenant has to happen first: every /admin route resolves
   * against the acting tenant, so navigating there without this shows the
   * previous university's figures, or none at all.
   */
  async function enter(t: TenantCard, to = '/admin') {
    await actAs(t.id);
    navigate(to);
  }

  return (
    <div className="console">
      <ConsoleHeader />

      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Universities</p>
            <h1>Who is on the platform.</h1>
            <p className="console-lede">
              {tenants
                ? `${counts.ACTIVE} live · ${counts.DRAFT} onboarding · ${totals.colleges} colleges · ${totals.students.toLocaleString('en-IN')} students`
                : 'Loading…'}
            </p>
          </div>
          <Link to="/platform/new" className="btn btn-primary btn-lg">
            + Onboard a university
          </Link>
        </section>

        <div className="console-bar">
          <div className="seg" role="radiogroup" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={filter === f.key}
                className={`seg-opt ${filter === f.key ? 'is-on' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="seg-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or city"
              aria-label="Search universities"
            />
          </div>
        </div>

        {error && <p className="status-error">{error}</p>}

        {tenants && tenants.length === 0 && (
          <div className="empty">
            <div className="empty-art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2>No universities yet.</h2>
            <p>Onboard the first one - it takes about ten minutes, and nothing is visible to anyone until you launch it.</p>
            <Link to="/platform/new" className="btn btn-primary">
              Onboard a university
            </Link>
          </div>
        )}

        {tenants && tenants.length > 0 && shown.length === 0 && <p className="muted">Nothing matches that.</p>}

        <ul className="tenants">
          {shown.map((t) => {
            const tokens = lightTokens(t.brandColor);
            const done = t.completedSteps.length;
            return (
              <li key={t.id} className={`tcard is-${t.status.toLowerCase()}`} style={{ ['--t-brand' as string]: tokens?.brand ?? t.brandColor, ['--t-soft' as string]: tokens?.soft }}>
                <div className="tcard-top">
                  <span className="tcard-logo">
                    {t.logoUrl ? <img src={t.logoUrl} alt="" /> : monogram(t.name, t.shortName)}
                  </span>
                  <span className="tcard-title">
                    <strong>{t.shortName || t.name}</strong>
                    <small>
                      {t.shortName ? `${t.name} · ` : ''}
                      {KIND_LABEL[t.kind]}
                      {t.city ? ` · ${t.city}` : ''}
                    </small>
                  </span>
                  <StatusPill status={t.status} />
                </div>

                {t.status === 'DRAFT' ? (
                  <div className="tcard-progress">
                    <Ring value={done / STEP_TOTAL} />
                    <span>
                      <strong>
                        {done} of {STEP_TOTAL} steps
                      </strong>
                      <small>Started {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>
                    </span>
                  </div>
                ) : (
                  <dl className="tcard-stats">
                    <div>
                      <dt>Colleges</dt>
                      <dd>{t.colleges}</dd>
                    </div>
                    <div>
                      <dt>Students</dt>
                      <dd>{t.students.toLocaleString('en-IN')}</dd>
                    </div>
                    <div>
                      <dt>Plan</dt>
                      <dd className="tcard-plan">{t.plan.toLowerCase()}</dd>
                    </div>
                  </dl>
                )}

                <div className="tcard-actions">
                  {t.status === 'DRAFT' ? (
                    <Link to={`/platform/tenants/${t.id}`} className="btn btn-primary">
                      Continue setup
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={() => enter(t)} disabled={t.status === 'SUSPENDED'}>
                      Open portal
                    </button>
                  )}
                  {t.status === 'ACTIVE' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => enter(t, '/admin/pulse')}
                    >
                      Activity
                    </button>
                  )}
                  <Link to={`/platform/tenants/${t.id}/review`} className="btn btn-ghost">
                    {t.status === 'DRAFT' ? 'Checklist' : 'Settings'}
                  </Link>
                  {acting?.id === t.id && <span className="tcard-here">You are here</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: TenantStatus }) {
  if (status === 'ACTIVE') return <span className="pill pill-pass">Live</span>;
  if (status === 'SUSPENDED') return <span className="pill pill-stop">Suspended</span>;
  return <span className="pill pill-hold">Onboarding</span>;
}

/** A small progress ring, because "3 of 6" reads faster as a shape. */
function Ring({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r={r} className="ring-bg" />
      <circle cx="20" cy="20" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  );
}
