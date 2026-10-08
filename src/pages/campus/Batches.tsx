import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { campusApi, type BatchSummary } from '../../api/campus';
import { ApiError } from '../../api/client';
import BatchForm from '../../components/BatchForm';

export default function Batches() {
  const [batches, setBatches] = useState<BatchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    try {
      setBatches(await campusApi.listBatches());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your batches.');
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
          <h1>Batches</h1>
          <p className="page-lede">
            One batch per class and graduating year. Students belong to a batch, and a batch is what
            a placement drive and a company&rsquo;s job posting are aimed at.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
        >
          {showForm ? 'Cancel' : 'Add batch'}
        </button>
      </header>

      {showForm && (
        <BatchForm
          onCreate={campusApi.createBatch}
          onDone={() => {
            setShowForm(false);
            void refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {batches === null && !error && <p className="muted">Loading…</p>}

      {batches?.length === 0 && (
        <div className="empty">
          <h2>No batches yet</h2>
          <p>
            A batch is the unit everything else hangs off — students join one, drives include one,
            and jobs are targeted at one.
          </p>
        </div>
      )}

      {batches && batches.length > 0 && (
        <ul className="ecards">
          {batches.map((b) => {
            const pending = b.studentCount - b.frozenCount;
            const pct = b.studentCount > 0 ? Math.round((b.frozenCount / b.studentCount) * 100) : 0;
            return (
              <li key={b.id}>
                <Link to={`/campus/batches/${b.id}`} className="ecard">
                  <span className="ecard-top">
                    <span className="ecard-tag">{b.course ?? 'No course'}</span>
                    {b.joinCodeEnabled ? (
                      <span className="pill pill-pass">Join link open</span>
                    ) : (
                      <span className="pill pill-idle">Join link off</span>
                    )}
                  </span>
                  <b className="ecard-title">{b.name}</b>
                  <span className="ecard-sub">
                    {[b.specialisation, b.headOfDept].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <dl className="ecard-facts">
                    <div>
                      <dt>Year</dt>
                      <dd>{b.graduationYear ?? (b.studyYear ? `Year ${b.studyYear}` : '—')}</dd>
                    </div>
                    <div>
                      <dt>Students</dt>
                      <dd>{b.studentCount}</dd>
                    </div>
                    <div>
                      <dt>Verified</dt>
                      <dd>{b.frozenCount}</dd>
                    </div>
                  </dl>
                  <span className="ecard-bar" aria-hidden="true">
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <span className="ecard-foot">
                    <small>
                      {b.studentCount === 0
                        ? 'No students yet'
                        : pending > 0
                          ? `${pending} pending verification`
                          : 'Everyone verified'}
                    </small>
                    <span className="ecard-go">Open →</span>
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
