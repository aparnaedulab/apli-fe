import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { campusApi, placementApi, type BatchSummary, type PlacementSummary } from '../../api/campus';
import { ApiError } from '../../api/client';

export default function Drives() {
  const [drives, setDrives] = useState<PlacementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    try {
      setDrives(await placementApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your drives.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Placement seasons</h1>
          <p className="page-lede">
            A drive is one hiring season — &ldquo;2026 Final Placements&rdquo;. It decides which
            batches take part, and it is the boundary the one-offer rule applies within.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
        >
          {showForm ? 'Cancel' : 'Open a drive'}
        </button>
      </header>

      {showForm && (
        <NewDriveForm
          onDone={() => {
            setShowForm(false);
            void refresh();
          }}
        />
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {drives === null && !error && <p className="muted">Loading…</p>}

      {drives?.length === 0 && (
        <div className="empty">
          <h2>No drives yet</h2>
          <p>
            Companies post jobs into a drive. Until one is open, nothing can be aimed at your
            students.
          </p>
        </div>
      )}

      {drives && drives.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Drive</th>
                <th>Type</th>
                <th className="num">Year</th>
                <th className="num">Batches</th>
                <th className="num">Students</th>
                <th className="num">Jobs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drives.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link to={`/campus/drives/${d.id}`} className="row-link">
                      {d.name}
                    </Link>
                    {d.oneOfferRule && <span className="row-sub">One offer per student</span>}
                  </td>
                  <td>{d.type === 'FINAL' ? 'Final placement' : 'Internship'}</td>
                  <td className="num">{d.year}</td>
                  <td className="num">{d.batchCount}</td>
                  <td className="num">{d.studentCount}</td>
                  <td className="num">{d.jobCount}</td>
                  <td>
                    {d.isOpen ? (
                      <span className="pill pill-pass">Open</span>
                    ) : (
                      <span className="pill pill-idle">Closed</span>
                    )}
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

function NewDriveForm({ onDone }: { onDone: () => void }) {
  const thisYear = new Date().getFullYear();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'FINAL' | 'INTERNSHIP'>('FINAL');
  const [year, setYear] = useState(String(thisYear + 1));
  const [oneOfferRule, setOneOfferRule] = useState(true);
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    campusApi.listBatches().then(setBatches).catch(() => setBatches([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await placementApi.create({
        name,
        type,
        year: Number(year),
        oneOfferRule,
        batchIds: [...batchIds],
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the drive.');
      setSaving(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={onSubmit} noValidate>
      <h2>Open a drive</h2>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="form-row">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="2026 Final Placements"
            disabled={saving}
          />
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'FINAL' | 'INTERNSHIP')}
            disabled={saving}
          >
            <option value="FINAL">Final placement</option>
            <option value="INTERNSHIP">Internship</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Year</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            disabled={saving}
          />
        </label>
      </div>

      <fieldset className="check-group">
        <legend className="field-label">Batches taking part</legend>
        {batches.length === 0 ? (
          <p className="muted">No batches yet. Create one first.</p>
        ) : (
          <div className="check-grid">
            {batches.map((b) => (
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
                    {b.course} · {b.studentCount} students
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="check standalone">
        <input
          type="checkbox"
          checked={oneOfferRule}
          onChange={(e) => setOneOfferRule(e.target.checked)}
        />
        <span>
          One offer per student
          <span className="check-sub">
            When a student accepts an offer, their other applications in this drive close
            automatically.
          </span>
        </span>
      </label>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Opening…' : 'Open drive'}
      </button>
    </form>
  );
}
