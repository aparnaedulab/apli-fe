import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { placementApi, type DriveSummary, type PlacementDetail } from '../../api/campus';
import { ApiError } from '../../api/client';

export default function DriveDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PlacementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<DriveSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await placementApi.get(id);
      setData(d);
      setBatchIds(new Set(d.placement.batches.map((b) => b.id)));
      placementApi.summary(id).then(setSummary).catch(() => setSummary(null));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this drive.');
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <CampusLayout>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/campus/drives">← All drives</Link>
        </p>
      </CampusLayout>
    );
  }

  if (!data) {
    return (
      <CampusLayout>
        <p className="muted">Loading…</p>
      </CampusLayout>
    );
  }

  const p = data.placement;
  const canDelete = p.jobCount === 0 && p.applicationCount === 0;

  return (
    <CampusLayout>
      <p className="crumb">
        <Link to="/campus/drives">← All drives</Link>
      </p>

      <header className="page-head">
        <div>
          <p className="eyebrow">{p.type === 'FINAL' ? 'Final placement' : 'Internship'} · {p.year}</p>
          <h1>{p.name}</h1>
          <p className="page-lede">
            {p.isOpen
              ? 'Open. Companies can be admitted and students can apply.'
              : 'Closed. No new applications.'}
          </p>
        </div>
        <button
          type="button"
          className={p.isOpen ? 'btn btn-secondary' : 'btn btn-primary'}
          disabled={busy}
          onClick={() => act(() => placementApi.update(p.id, { isOpen: !p.isOpen }))}
        >
          {p.isOpen ? 'Close drive' : 'Reopen drive'}
        </button>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="stat-row">
        <Stat label="Batches" value={p.batches.length} />
        <Stat label="Students" value={p.studentCount} />
        <Stat label="Eligible" value={p.verifiedCount} />
        <Stat label="Jobs" value={p.jobCount} />
        <Stat label="Applications" value={p.applicationCount} />
      </div>

      {p.studentCount > p.verifiedCount && (
        <p className="alert alert-warn">
          {p.studentCount - p.verifiedCount} of {p.studentCount} students in this drive are not
          verified yet, so they cannot apply to anything in it.
        </p>
      )}

      {summary && summary.applications > 0 && (
        <section className="card">
          <h2>How the season is going</h2>
          <div className="stat-row inner">
            <div className="stat">
              <p className="stat-value">{summary.placedPercent}%</p>
              <p className="stat-label">Placed</p>
            </div>
            <div className="stat">
              <p className="stat-value">
                {summary.placed}
                <span className="stat-of">/ {summary.studentCount}</span>
              </p>
              <p className="stat-label">Students placed</p>
            </div>
            <div className="stat">
              <p className="stat-value">{summary.companiesVisiting}</p>
              <p className="stat-label">Companies</p>
            </div>
            <div className="stat">
              <p className="stat-value">
                {summary.highestCtc ? `${(summary.highestCtc / 100000).toFixed(1)}L` : '—'}
              </p>
              <p className="stat-label">Highest CTC</p>
            </div>
            <div className="stat">
              <p className="stat-value">
                {summary.averageCtc ? `${(summary.averageCtc / 100000).toFixed(1)}L` : '—'}
              </p>
              <p className="stat-label">Average CTC</p>
            </div>
          </div>

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
                <span className="funnel-value">{summary.byStatus[k] ?? 0}</span>
                <span className="funnel-label">{k.replace('_', ' ').toLowerCase()}</span>
              </div>
            ))}
          </div>

          {summary.recentOffers.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentOffers.map((o, i) => (
                  <tr key={`${o.company}-${i}`}>
                    <td className="row-link">{o.company}</td>
                    <td>{o.role}</td>
                    <td>
                      <span
                        className={`pill ${o.status === 'OFFERED' ? 'pill-hold' : 'pill-pass'}`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Batches taking part</h2>
          <button type="button" className="link-btn" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Change'}
          </button>
        </div>

        {editing ? (
          <>
            <div className="check-grid">
              {data.allBatches.map((b) => (
                <label key={b.id} className="check">
                  <input
                    type="checkbox"
                    checked={batchIds.has(b.id)}
                    onChange={(e) => {
                      const next = new Set(batchIds);
                      if (e.target.checked) next.add(b.id);
                      else next.delete(b.id);
                      setBatchIds(next);
                    }}
                  />
                  <span>
                    {b.name}
                    <span className="check-sub">
                      {b.course} · graduating {b.graduationYear}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await placementApi.setBatches(p.id, [...batchIds]);
                  setEditing(false);
                })
              }
            >
              {busy ? 'Saving…' : 'Save batches'}
            </button>
          </>
        ) : p.batches.length === 0 ? (
          <p className="muted">
            No batches yet. A drive with no batches reaches nobody — add at least one.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Course</th>
                <th className="num">Graduating</th>
                <th className="num">Students</th>
              </tr>
            </thead>
            <tbody>
              {p.batches.map((b) => (
                <tr key={b.id}>
                  <td className="row-link">{b.name}</td>
                  <td>{b.course}</td>
                  <td className="num">{b.graduationYear}</td>
                  <td className="num">{b.studentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Rules</h2>
        <label className="check standalone">
          <input
            type="checkbox"
            checked={p.oneOfferRule}
            disabled={busy}
            onChange={(e) => act(() => placementApi.update(p.id, { oneOfferRule: e.target.checked }))}
          />
          <span>
            One offer per student
            <span className="check-sub">
              When a student accepts an offer here, their other live applications in this drive
              close automatically. Turn it off for internship drives where students may hold
              several.
            </span>
          </span>
        </label>
      </section>

      {canDelete && (
        <section className="card">
          <h2>Delete this drive</h2>
          <p className="muted">
            Nothing has been posted into it yet, so it can still be removed. Once a company posts a
            job here, close it instead.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await placementApi.remove(p.id);
                navigate('/campus/drives', { replace: true });
              })
            }
          >
            Delete drive
          </button>
        </section>
      )}
    </CampusLayout>
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
