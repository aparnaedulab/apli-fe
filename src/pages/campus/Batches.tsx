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
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Course</th>
                <th className="num">Year</th>
                <th className="num">Students</th>
                <th className="num">Verified</th>
                <th>Join link</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/campus/batches/${b.id}`} className="row-link">
                      {b.name}
                    </Link>
                    {b.headOfDept && <span className="row-sub">{b.headOfDept}</span>}
                  </td>
                  <td>
                    {b.course ?? <span className="muted">—</span>}
                    {b.specialisation && <span className="row-sub">{b.specialisation}</span>}
                  </td>
                  <td className="num">
                    {b.graduationYear ?? (b.studyYear ? `Year ${b.studyYear}` : <span className="muted">—</span>)}
                  </td>
                  <td className="num">{b.studentCount}</td>
                  <td className="num">
                    {b.frozenCount}
                    {b.studentCount > 0 && b.frozenCount < b.studentCount && (
                      <span className="row-sub">{b.studentCount - b.frozenCount} pending</span>
                    )}
                  </td>
                  <td>
                    {b.joinCodeEnabled ? (
                      <span className="pill pill-pass">Open</span>
                    ) : (
                      <span className="pill pill-idle">Off</span>
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
