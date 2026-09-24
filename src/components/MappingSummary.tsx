import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { MappingSummaryCollege } from '../api/mapping';

/**
 * Everything mapped so far, read-only: college -> course -> branches, with
 * how many students are in each. Colleges with nothing mapped are listed at
 * the end, so it is plain which are still to do.
 */
export default function MappingSummary({
  load,
  allColleges,
  onEdit,
}: {
  load: () => Promise<{ colleges: MappingSummaryCollege[] }>;
  /** Every college, so the unmapped ones can be named too. */
  allColleges: { id: string; name: string; code: string }[];
  /** Jump to editing one college. */
  onEdit?: (collegeId: string) => void;
}) {
  const [colleges, setColleges] = useState<MappingSummaryCollege[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then((r) => setColleges(r.colleges))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the mapped data.'));
  }, [load]);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!colleges) return <p className="md-muted">Loading…</p>;

  const f = filter.trim().toLowerCase();
  const shown = colleges.filter(
    (c) =>
      !f ||
      c.name.toLowerCase().includes(f) ||
      c.code.toLowerCase().includes(f) ||
      c.courses.some(
        (co) => co.course.toLowerCase().includes(f) || co.branches.some((b) => b.branch?.toLowerCase().includes(f)),
      ),
  );
  const mappedIds = new Set(colleges.map((c) => c.id));
  const unmapped = allColleges.filter((c) => !mappedIds.has(c.id));
  const pairs = colleges.reduce((n, c) => n + c.courses.reduce((m, co) => m + co.branches.length, 0), 0);
  const students = colleges.reduce(
    (n, c) => n + c.courses.reduce((m, co) => m + co.branches.reduce((k, b) => k + b.students, 0), 0),
    0,
  );

  return (
    <div className="ms">
      <p className="md-muted">
        {colleges.length} of {allColleges.length} colleges mapped · {pairs} course/branch pair
        {pairs === 1 ? '' : 's'} · {students} student{students === 1 ? '' : 's'} placed in them
      </p>

      {colleges.length > 0 && (
        <input
          className="md-search"
          type="search"
          placeholder="Filter by college, course or branch"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}

      {colleges.length === 0 && <p className="md-muted">Nothing is mapped yet.</p>}

      <table className="md-table ms-table">
        {shown.length > 0 && (
          <thead>
            <tr>
              <th>College</th>
              <th>Course</th>
              <th>Branches</th>
              <th className="ms-num">Students</th>
            </tr>
          </thead>
        )}
        {shown.map((c) =>
          c.courses.map((co, i) => (
            <tbody key={`${c.id}-${co.course}`} className={i === 0 ? 'ms-first' : ''}>
              <tr>
                {i === 0 && (
                  <td rowSpan={c.courses.length} className="ms-college">
                    <span className="md-name">{c.code}</span>
                    <span className="md-sub">{c.name}</span>
                    {onEdit && (
                      <button type="button" className="link-btn ms-edit" onClick={() => onEdit(c.id)}>
                        Edit
                      </button>
                    )}
                  </td>
                )}
                <td className="ms-course">{co.course}</td>
                <td>
                  <ul className="ms-branches">
                    {co.branches.map((b) => (
                      <li key={b.branch ?? '-'}>
                        {b.branch ?? 'Whole course'}
                        {b.students > 0 && <span className="md-count">{b.students}</span>}
                        {b.intake ? <span className="md-sub ms-seats">{b.intake} seats</span> : null}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="ms-num">{co.branches.reduce((n, b) => n + b.students, 0)}</td>
              </tr>
            </tbody>
          )),
        )}
      </table>

      {unmapped.length > 0 && !f && (
        <p className="md-muted">
          Not mapped yet:{' '}
          {unmapped.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              {onEdit ? (
                <button type="button" className="link-btn" onClick={() => onEdit(c.id)}>
                  {c.code}
                </button>
              ) : (
                c.code
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
