import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { adminMapping, type CollegeProgram, type OfferedCourse } from '../../api/mapping';
import { ProgramsEditor } from '../../components/MapData';

/**
 * Set up, step 2: the courses and branches the university runs, picked from
 * the platform catalogue. Colleges then choose from this, and only this.
 *
 * A course or branch a college already runs is locked on, the same way a
 * college's programme is locked while students are in it.
 */
export default function UniversityPrograms({ onSaved }: { onSaved?: () => void }) {
  const [catalogue, setCatalogue] = useState<OfferedCourse[] | null>(null);
  const [programs, setPrograms] = useState<CollegeProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminMapping.offered();
      setCatalogue(r.catalogue);
      setPrograms(r.programs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the courses.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!catalogue || !programs) return <p className="muted">Loading…</p>;

  return (
    <ProgramsEditor
      offered={{ courses: catalogue, fromCatalogue: false }}
      programs={programs}
      collegeName="The university"
      withIntake={false}
      lockedLabel={(n) => `${n} college${n === 1 ? '' : 's'}`}
      lockedTitle="A college runs this - take it off the college first"
      lede={
        <>
          Tick every course the university runs, and the branches inside it. Missing a course or branch?
          It is added once, for the whole platform, under <b>Lists → Courses and branches</b> (step 0).
        </>
      }
      save={async (choices) => {
        const next = await adminMapping.saveOffered(choices);
        setPrograms(next);
        onSaved?.();
        return next;
      }}
    />
  );
}
