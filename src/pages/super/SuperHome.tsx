import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { platformApi, type TenantCard } from '../../api/platform';
import ConsoleHeader from '../platform/ConsoleHeader';
import { SETUP_STEPS, stepsDone } from './steps';
import '../platform/Platform.css';
import './super.css';

/**
 * The super admin's home: every institution created on Apli.ai.
 *
 * One card each, saying how far its setup got and offering the one next
 * thing to do. "New institution" starts the setup.
 */

const KIND = { UNIVERSITY: 'University', COLLEGE: 'College', GROUP: 'Group' } as const;
const STATUS = {
  DRAFT: { label: 'Setting up', tone: 'is-draft' },
  ACTIVE: { label: 'Live', tone: 'is-live' },
  SUSPENDED: { label: 'Paused', tone: 'is-paused' },
} as const;

export default function SuperHome() {
  const [tenants, setTenants] = useState<TenantCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    platformApi
      .tenants()
      .then((r) => setTenants(r.tenants))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the institutions.'));
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (tenants ?? []).filter(
      (t) => !s || [t.name, t.shortName, t.city, t.state].some((v) => v?.toLowerCase().includes(s)),
    );
  }, [tenants, q]);

  const totals = useMemo(() => {
    const all = tenants ?? [];
    return {
      institutions: all.length,
      live: all.filter((t) => t.status === 'ACTIVE').length,
      colleges: all.reduce((n, t) => n + t.colleges, 0),
      students: all.reduce((n, t) => n + t.students, 0),
    };
  }, [tenants]);

  return (
    <div className="console">
      <ConsoleHeader />

      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Super admin</p>
            <h1>Institutions</h1>
            <p className="console-lede">Every university and college set up on Apli.ai.</p>
          </div>
          <Link to="/platform/new" className="btn btn-primary sa-new">
            + New university
          </Link>
        </section>

        {tenants && tenants.length > 0 && (
          <dl className="sa-totals">
            <div>
              <dt>Institutions</dt>
              <dd>{totals.institutions}</dd>
            </div>
            <div>
              <dt>Live</dt>
              <dd>{totals.live}</dd>
            </div>
            <div>
              <dt>Colleges</dt>
              <dd>{totals.colleges.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt>Students</dt>
              <dd>{totals.students.toLocaleString('en-IN')}</dd>
            </div>
          </dl>
        )}

        {error && <p className="notice notice-stop">{error}</p>}
        {!tenants && !error && <p className="muted">Loading…</p>}

        {tenants && tenants.length === 0 && (
          <div className="sa-empty">
            <h2>No universities yet</h2>
            <p className="muted">Set up the first university: its details, its colleges, then its courses.</p>
            <Link to="/platform/new" className="btn btn-primary">
              Set up a university
            </Link>
          </div>
        )}

        {tenants && tenants.length > 0 && (
          <>
            <div className="console-bar">
              <input
                className="input sa-search"
                type="search"
                placeholder="Search by name or city"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search institutions"
              />
            </div>

            {shown.length === 0 && <p className="co-empty">Nothing matches “{q}”.</p>}

            <ul className="sa-grid">
              {shown.map((t) => {
                const done = stepsDone(t);
                const next = SETUP_STEPS.find((s) => !done.has(s.key));
                return (
                  <li key={t.id}>
                    <Link to={`/platform/tenants/${t.id}`} className="sa-card">
                      <div className="sa-card-top">
                        <span className="sa-mark" style={{ background: t.brandColor }} aria-hidden="true">
                          {t.logoUrl ? (
                            <img src={t.logoUrl} alt="" />
                          ) : (
                            (t.shortName || t.name).slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <span className={`sa-status ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>
                      </div>
                      <h2>{t.name}</h2>
                      <p className="muted">
                        {KIND[t.kind]}
                        {t.city ? ` · ${[t.city, t.state].filter(Boolean).join(', ')}` : ''}
                      </p>

                      <ol className="sa-steps" aria-label="Setup">
                        {SETUP_STEPS.map((s) => (
                          <li key={s.key} className={done.has(s.key) ? 'is-done' : ''} title={s.label}>
                            <span />
                            {s.short}
                          </li>
                        ))}
                      </ol>

                      <div className="sa-card-foot">
                        <span>
                          <b>{t.colleges}</b> colleges · <b>{t.students.toLocaleString('en-IN')}</b> students
                        </span>
                        <span className="sa-go">{next ? `Continue: ${next.short}` : 'Open'} →</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
