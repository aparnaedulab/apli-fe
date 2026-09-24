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
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Drive</th>
                <th className="num">Rounds</th>
                <th>CTC</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/campus/requests/${p.id}`} className="row-link">
                      {p.title}
                    </Link>
                    {p.location && <span className="row-sub">{p.location}</span>}
                  </td>
                  <td>
                    {p.companyName}
                    {!p.companyVerified && <span className="row-sub">Not verified</span>}
                  </td>
                  <td>{p.placementName}</td>
                  <td className="num">{p.roundCount}</td>
                  <td>{money(p.ctcMin, p.ctcMax)}</td>
                  <td>{new Date(p.deadline).toLocaleDateString()}</td>
                  <td>
                    <span
                      className={`pill ${
                        p.status === 'ACCEPTED'
                          ? 'pill-pass'
                          : p.status === 'DECLINED'
                            ? 'pill-stop'
                            : 'pill-hold'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CampusLayout>
  );
}
