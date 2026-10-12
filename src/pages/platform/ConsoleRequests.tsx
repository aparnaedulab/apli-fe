import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import { partnersApi, type PartnerRequest, type PartnerRequestStatus } from '../../api/partners';
import ConsoleHeader from './ConsoleHeader';
import './Platform.css';

/**
 * Universities and colleges that asked to partner, from the public request
 * form. The platform team gets in touch, records that it has, and onboards
 * the institution through the wizard - the request itself never becomes an
 * account.
 */

const STATUS: Record<PartnerRequestStatus, { label: string; tone: string }> = {
  NEW: { label: 'New', tone: 'is-new' },
  CONTACTED: { label: 'Contacted', tone: 'is-contacted' },
  CLOSED: { label: 'Closed', tone: 'is-closed' },
};

const FILTERS: { key: PartnerRequestStatus | 'ALL'; label: string }[] = [
  { key: 'NEW', label: 'New' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'ALL', label: 'All' },
];

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ConsoleRequests() {
  const [list, setList] = useState<PartnerRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PartnerRequestStatus | 'ALL'>('NEW');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    partnersApi
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the requests.'));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { NEW: 0, CONTACTED: 0, CLOSED: 0, ALL: 0 };
    for (const r of list ?? []) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      c.ALL! += 1;
    }
    return c;
  }, [list]);

  const shown = (list ?? []).filter((r) => filter === 'ALL' || r.status === filter);

  async function move(r: PartnerRequest, status: PartnerRequestStatus) {
    setBusy(r.id);
    try {
      const { request } = await partnersApi.setStatus(r.id, status);
      setList((all) => (all ?? []).map((x) => (x.id === request.id ? request : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update that request.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="console">
      <ConsoleHeader />

      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Partner requests</p>
            <h1>Institutions asking to join.</h1>
            <p className="console-lede">
              {counts.NEW ? `${counts.NEW} new · ` : 'Nothing new · '}
              {counts.CONTACTED} contacted · {counts.ALL} in all
            </p>
          </div>
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
                {f.label} <span className="seg-count">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="notice notice-stop">{error}</p>}
        {!list && !error && <p className="muted">Loading…</p>}

        {list && shown.length === 0 && (
          <p className="co-empty">
            {filter === 'NEW'
              ? 'No new requests. They arrive from the "Bring Apli.ai to your campus" form.'
              : 'Nothing here.'}
          </p>
        )}

        <ul className="rq-list">
          {shown.map((r) => (
            <li key={r.id} className="rq">
              <div className="rq-head">
                <span className={`rq-status ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span>
                <span className="rq-kind">{r.kind === 'UNIVERSITY' ? 'University' : 'College'}</span>
                <span className="rq-when">{when(r.createdAt)}</span>
              </div>
              <h3>{r.institutionName}</h3>
              <p className="rq-where">
                {[r.city, r.state].filter(Boolean).join(', ')}
                {r.students ? ` · about ${r.students.toLocaleString('en-IN')} students` : ''}
              </p>
              <dl className="rq-contact">
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {r.contactName}, {r.contactRole}
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{r.email}</dd>
                </div>
                {r.phone && (
                  <div>
                    <dt>Phone</dt>
                    <dd>{r.phone}</dd>
                  </div>
                )}
              </dl>
              {r.message && <p className="rq-message">“{r.message}”</p>}
              <div className="rq-actions">
                {r.status !== 'CONTACTED' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy === r.id}
                    onClick={() => move(r, 'CONTACTED')}
                  >
                    Mark contacted
                  </button>
                )}
                {r.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy === r.id}
                    onClick={() => move(r, 'CLOSED')}
                  >
                    Close
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy === r.id}
                    onClick={() => move(r, 'NEW')}
                  >
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
