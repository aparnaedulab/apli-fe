import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api, ApiError } from '../../api/client';
import { adminApi } from '../../api/admin';
import AddStudents from '../../components/AddStudents';

interface BatchStudent {
  membershipId: string;
  candidateId: string;
  name: string;
  email: string;
  rollNo: string | null;
  division: string | null;
  prn: string | null;
  phone: string | null;
  cgpa: string | null;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  college: string | null;
  collegeCode: string | null;
  isFrozen: boolean;
  hasClaimed: boolean;
}

interface BatchDetail {
  batch: {
    id: string;
    name: string;
    course: string | null;
    specialisation: string | null;
    graduationYear: number | null;
    studyYear: number | null;
    headOfDept: string | null;
    collegeId: string | null;
    collegeName: string;
    college: { id: string; name: string; code: string } | null;
  };
  students: BatchStudent[];
}

/**
 * One batch, and adding students to it.
 *
 * Operations reaches every batch from here, including university-wide ones,
 * which no college-scoped screen can show. A student always belongs to a
 * college even when their batch does not, so a university-wide batch asks
 * which college the students being added come from.
 */
export default function AdminBatchDetail() {
  const { id = '' } = useParams();
  const [data, setData] = useState<BatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colleges, setColleges] = useState<{ id: string; name: string; code: string }[]>([]);
  const [collegeId, setCollegeId] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.get<BatchDetail>(`/admin/batches/${id}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this batch.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const spansUniversity = data?.batch.collegeId === null;

  // Only needed when the batch itself does not name a college.
  useEffect(() => {
    if (!spansUniversity) return;
    adminApi
      .listColleges({ limit: 100, sort: 'name' })
      .then((r) => setColleges(r.colleges.map((c) => ({ id: c.id, name: c.name, code: c.code }))))
      .catch(() => setColleges([]));
  }, [spansUniversity]);

  if (error && !data) {
    return (
      <AdminLayout>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/admin/batches">← All batches</Link>
        </p>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout>
        <p className="muted">Loading…</p>
      </AdminLayout>
    );
  }

  const { batch, students } = data;
  const frozen = students.filter((s) => s.isFrozen).length;
  const claimed = students.filter((s) => s.hasClaimed).length;

  const canAdd = !spansUniversity || Boolean(collegeId);

  return (
    <AdminLayout>
      <p className="crumb">
        <Link to="/admin/batches">← All batches</Link>
      </p>

      <header className="page-head">
        <div>
          <h1>{batch.name}</h1>
          <p className="page-lede">
            {batch.college ? (
              <Link to={`/admin/colleges/${batch.college.id}`}>{batch.college.name}</Link>
            ) : (
              'Spans the university — students may come from any college.'
            )}
            {batch.course && ` · ${batch.course}`}
            {batch.specialisation && ` · ${batch.specialisation}`}
            {batch.graduationYear && ` · graduating ${batch.graduationYear}`}
            {!batch.graduationYear && batch.studyYear && ` · year ${batch.studyYear}`}
          </p>
        </div>
      </header>

      <div className="stat-strip">
        <span className="stat-item">
          <b>{students.length}</b> student{students.length === 1 ? '' : 's'}
        </span>
        <span className="stat-item">
          <b>{claimed}</b> signed in
        </span>
        <span className="stat-item">
          <b>{frozen}</b> verified
        </span>
      </div>

      <section className="card">
        <h2>Roster</h2>
        {students.length === 0 ? (
          <p className="muted">
            Nobody in this batch yet. Add them below — they appear here at once, and each gets a
            one-time link to set their own password.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  {spansUniversity && <th>College</th>}
                  <th>Roll no.</th>
                  <th>Course</th>
                  <th className="num">CGPA</th>
                  <th>Account</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.membershipId}>
                    <td>
                      {s.name}
                      <span className="row-sub mono">{s.email}</span>
                    </td>
                    {spansUniversity && <td>{s.collegeCode ?? '—'}</td>}
                    <td>
                      {s.rollNo ?? '—'}
                      {s.prn && <span className="row-sub">{s.prn}</span>}
                    </td>
                    <td>
                      {s.course ?? '—'}
                      {s.specialisation && <span className="row-sub">{s.specialisation}</span>}
                    </td>
                    <td className="num">{s.cgpa ?? '—'}</td>
                    <td>
                      {s.hasClaimed ? (
                        <span className="pill pill-pass">Joined</span>
                      ) : (
                        <span className="pill pill-idle">Not yet</span>
                      )}
                    </td>
                    <td>
                      {s.isFrozen ? (
                        <span className="pill pill-pass">Frozen</span>
                      ) : (
                        <span className="pill pill-hold">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {spansUniversity && (
        <section className="card form-card">
          <label className="field">
            <span className="field-label">
              Which college are these students from?<span className="req">required</span>
            </span>
            <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>
              <option value="">Choose a college</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <span className="field-hint">
              This batch spans the university, but every student belongs to one college. Add one
              college&rsquo;s students, then switch and add the next.
            </span>
          </label>
        </section>
      )}

      {canAdd && (
        <section className="card">
          <h2>Add students</h2>
          <AddStudents
            endpoint={`/admin/batches/${batch.id}/students`}
            batchName={batch.name}
            extra={spansUniversity ? { collegeId } : undefined}
            onDone={load}
          />
        </section>
      )}
    </AdminLayout>
  );
}
