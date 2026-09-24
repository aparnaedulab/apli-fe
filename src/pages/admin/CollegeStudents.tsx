import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { NewBatch } from '../../api/campus';
import AddStudents from '../../components/AddStudents';
import BatchForm from '../../components/BatchForm';

interface Batch {
  id: string;
  name: string;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  studyYear: number | null;
  studentCount: number;
}

/**
 * Batches and students, on a college's behalf.
 *
 * Normally the college does this itself. This exists for the case that
 * actually happens during a rollout: the college has sent over its lists but
 * nobody there has accepted their invitation yet, so operations enters them.
 *
 * Both things are here because they are separate jobs. A roster paste creates
 * the batches it names, but a batch like "Aptitude cleared" has no students to
 * paste yet - it is made empty and filled later.
 */
export default function CollegeStudents({
  collegeId,
  collegeName,
}: {
  collegeId: string;
  collegeName?: string;
}) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingBatch, setAddingBatch] = useState(false);

  const load = useCallback(async () => {
    try {
      const { batches: list } = await api.get<{ batches: Batch[] }>(
        `/admin/colleges/${collegeId}/batches`,
      );
      setBatches(list);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load batches.');
    }
  }, [collegeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createBatch = useCallback(
    (batch: NewBatch) => api.post(`/admin/colleges/${collegeId}/batches`, batch),
    [collegeId],
  );

  const total = (batches ?? []).reduce((n, b) => n + b.studentCount, 0);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Batches</h2>
          <div className="btn-row">
            {batches !== null && (
              <span className="muted">
                {total} student{total === 1 ? '' : 's'} across {batches.length} batch
                {batches.length === 1 ? '' : 'es'}
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAddingBatch((v) => !v)}
              aria-expanded={addingBatch}
            >
              {addingBatch ? 'Cancel' : 'Add batch'}
            </button>
          </div>
        </div>

        {error && <p className="alert alert-error">{error}</p>}

        {batches && batches.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Course</th>
                <th>Year</th>
                <th className="num">Students</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/admin/batches/${b.id}`} className="row-link">
                      {b.name}
                    </Link>
                  </td>
                  <td>
                    {b.course ?? <span className="muted">—</span>}
                    {b.specialisation && <span className="row-sub">{b.specialisation}</span>}
                  </td>
                  <td>
                    {b.graduationYear ? (
                      `Graduating ${b.graduationYear}`
                    ) : b.studyYear ? (
                      `Year ${b.studyYear}`
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">{b.studentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          batches !== null &&
          !addingBatch && (
            <p className="muted">
              No batches yet. Add one here, or paste a student list below — any batch it names is
              created as the rows go in.
            </p>
          )
        )}
      </section>

      {addingBatch && (
        <BatchForm
          onCreate={createBatch}
          collegeName={collegeName}
          onDone={() => {
            setAddingBatch(false);
            void load();
          }}
          onCancel={() => setAddingBatch(false)}
        />
      )}

      <section className="card">
        <h2>Students</h2>
        <AddStudents endpoint={`/admin/colleges/${collegeId}/students`} onDone={load} />
      </section>
    </>
  );
}
