import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { postingApi, type PostingRow } from '../../api/campus';
import { ApiError } from '../../api/client';

type Filter = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ALL';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'PENDING', label: 'Waiting on you' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'ALL', label: 'All' },
];

function money(min: string | null, max: string | null): string {
  const lakhs = (v: string) => `${(Number(v) / 100000).toFixed(1)}L`;
  if (min && max) return `₹${lakhs(min)} – ${lakhs(max)}`;
  if (min) return `from ₹${lakhs(min)}`;
  if (max) return `up to ₹${lakhs(max)}`;
  return '—';
}

export default function JobRequests() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [rows, setRows] = useState<PostingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRows(null);
    try {
      setRows(await postingApi.list(filter));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load job requests.');
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Job requests</h1>
          <p className="page-lede">
            Every role a company wants to put in front of your students. Nothing is visible to them
            until you accept it.
          </p>
        </div>
      </header>

      <div className="tabs-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`tabs-btn ${filter === f.key ? 'is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {rows === null && !error && <p className="muted">Loading…</p>}

      {rows?.length === 0 && (
        <div className="empty">
          <h2>{filter === 'PENDING' ? 'Nothing waiting on you' : 'Nothing here'}</h2>
          <p>
            {filter === 'PENDING'
              ? 'When a company publishes a role aimed at one of your drives, it lands here first.'
              : 'Try another filter.'}
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="ecards">
          {rows.map((p) => {
            const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86_400_000);
            return (
              <li key={p.id}>
                <Link to={`/campus/requests/${p.id}`} className={`ecard ${p.status === 'DECLINED' ? 'is-muted' : ''}`}>
                  <span className="ecard-top">
                    <span className="ecard-tag">{p.placementName}</span>
                    <span
                      className={`pill ${
                        p.status === 'ACCEPTED' ? 'pill-pass' : p.status === 'DECLINED' ? 'pill-stop' : 'pill-hold'
                      }`}
                    >
                      {p.status === 'ACCEPTED' ? 'Accepted' : p.status === 'DECLINED' ? 'Declined' : 'Waiting on you'}
                    </span>
                  </span>
                  <b className="ecard-title">{p.title}</b>
                  <span className="ecard-sub">
                    {p.companyName}
                    {!p.companyVerified && ' · not verified'}
                    {p.location ? ` · ${p.location}` : ''}
                  </span>
                  <dl className="ecard-facts">
                    <div>
                      <dt>Package</dt>
                      <dd>{money(p.ctcMin, p.ctcMax)}</dd>
                    </div>
                    <div>
                      <dt>Rounds</dt>
                      <dd>{p.roundCount}</dd>
                    </div>
                    <div>
                      <dt>Apply by</dt>
                      <dd className={days >= 0 && days <= 3 ? 'is-soon' : ''}>
                        {new Date(p.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </dd>
                    </div>
                  </dl>
                  <span className="ecard-foot">
                    <small>{p.status === 'PENDING' ? 'Students cannot see it until you accept' : p.declineReason ?? ''}</small>
                    <span className="ecard-go">{p.status === 'PENDING' ? 'Review →' : 'Open →'}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CampusLayout>
  );
}
