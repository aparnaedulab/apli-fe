import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import MapData from '../../components/MapData';
import { ApiError } from '../../api/client';
import { campusMapping, type Offered } from '../../api/mapping';

/**
 * The college's own Map data: which of the university's courses and branches
 * it runs, and which of its students are in each. The university may already
 * have done some of this; whatever it did shows here and can be carried on.
 */
export default function Programs() {
  const [college, setCollege] = useState<{ name: string; code: string } | null>(null);
  const [offered, setOffered] = useState<Offered | null>(null);
  const [counts, setCounts] = useState({ students: 0, mapped: 0 });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await campusMapping.overview();
      setCollege(r.college);
      setOffered(r.offered);
      setCounts({ students: r.students, mapped: r.mapped });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your courses.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <h1>Courses &amp; students</h1>
          <p className="page-lede">
            Choose the courses and branches your college runs from the university's list, then put each
            student into one. {college && `${counts.mapped} of ${counts.students} students are mapped.`}
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!college && !error && <p className="muted">Loading…</p>}

      {college && offered && (
        <MapData scope={campusMapping.scope} offered={offered} collegeName={college.name} onChanged={load} />
      )}
    </CampusLayout>
  );
}
