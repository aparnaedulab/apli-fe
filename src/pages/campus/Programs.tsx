import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import CampusLayout from './CampusLayout';
import MapData from '../../components/MapData';
import { ApiError } from '../../api/client';
import { campusMapping, type CollegeProgram, type Offered } from '../../api/mapping';
import './Programs.css';

/**
 * The college's courses and students, as a card per course and branch.
 *
 * Each card says how many students are in it, against its seats when the
 * college gave a number. Opening one shows those students in a side panel,
 * where they can be added or taken out; changing which courses the college
 * runs is one button away, in the same panel. The editing itself is the
 * shared Map data component, so it behaves exactly as it does elsewhere.
 */
type Panel = { kind: 'courses' } | { kind: 'students'; programId?: string } | null;

export default function Programs() {
  const [college, setCollege] = useState<{ name: string; code: string } | null>(null);
  const [offered, setOffered] = useState<Offered | null>(null);
  const [programs, setPrograms] = useState<CollegeProgram[] | null>(null);
  const [counts, setCounts] = useState({ students: 0, mapped: 0 });
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await campusMapping.overview();
      setCollege(r.college);
      setOffered(r.offered);
      setPrograms(r.programs);
      setCounts({ students: r.students, mapped: r.mapped });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your courses.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const close = useCallback(() => setPanel(null), []);
  const unplaced = Math.max(0, counts.students - counts.mapped);

  /* Grouped by course, so B.Tech's branches sit together. */
  const sorted = [...(programs ?? [])].sort(
    (a, b) => a.course.localeCompare(b.course) || (a.branch ?? '').localeCompare(b.branch ?? ''),
  );

  return (
    <CampusLayout>
      <header className="pg-head">
        <div>
          <h1>Courses &amp; students</h1>
          <p>
            The courses and branches your college runs, and the students in each.
            {college && counts.students > 0 && ` ${counts.mapped} of ${counts.students} students are in a course.`}
          </p>
        </div>
        {college && (
          <span className="pg-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setPanel({ kind: 'courses' })}>
              Edit courses &amp; branches
            </button>
            {sorted.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => setPanel({ kind: 'students' })}>
                Map students
              </button>
            )}
          </span>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!college && !error && <p className="muted">Loading…</p>}

      {college && unplaced > 0 && sorted.length > 0 && (
        <button type="button" className="pg-notice" onClick={() => setPanel({ kind: 'students' })}>
          <b>
            {unplaced} student{unplaced === 1 ? ' is' : 's are'} not in any course yet.
          </b>
          <span>They cannot be matched to roles until they are. Map them →</span>
        </button>
      )}

      {college && sorted.length === 0 && (
        <div className="pg-empty">
          <h2>No courses yet</h2>
          <p>Choose the courses and branches your college runs from the university’s list.</p>
          <button type="button" className="btn btn-primary" onClick={() => setPanel({ kind: 'courses' })}>
            Choose courses
          </button>
        </div>
      )}

      {sorted.length > 0 && (
        <ul className="pg-grid">
          {sorted.map((p) => {
            const pct = p.intake ? Math.min(100, Math.round((p.students / p.intake) * 100)) : null;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="pg-card"
                  onClick={() => setPanel({ kind: 'students', programId: p.id })}
                >
                  <span className="pg-course">{p.course}</span>
                  <b className="pg-branch">{p.branch ?? 'Whole course'}</b>
                  <span className="pg-count">
                    <strong>{p.students}</strong> student{p.students === 1 ? '' : 's'}
                  </span>
                  {pct !== null ? (
                    <span className="pg-seats">
                      <span className="pg-bar" aria-hidden="true">
                        <i style={{ width: `${pct}%` }} />
                      </span>
                      <small>
                        {p.students} / {p.intake} seats
                      </small>
                    </span>
                  ) : (
                    <span className="pg-seats">
                      <small>No seat count set</small>
                    </span>
                  )}
                  <span className="pg-go">View students →</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {panel && college && offered && (
        <SidePanel
          title={panel.kind === 'courses' ? 'Courses & branches' : 'Students in each course'}
          subtitle={college.name}
          onClose={close}
        >
          <MapData
            key={panel.kind === 'students' ? `s-${panel.programId ?? ''}` : 'c'}
            scope={campusMapping.scope}
            offered={offered}
            collegeName={college.name}
            onChanged={load}
            only={panel.kind === 'courses' ? 'programs' : 'students'}
            initialProgramId={panel.kind === 'students' ? panel.programId : undefined}
          />
        </SidePanel>
      )}
    </CampusLayout>
  );
}

/** A panel that slides in from the right. Escape or the backdrop closes it. */
function SidePanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return (
    <div className="pg-panel-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pg-panel" role="dialog" aria-modal="true" aria-labelledby="pg-panel-title" tabIndex={-1} ref={box}>
        <header className="pg-panel-head">
          <div>
            <h2 id="pg-panel-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="pg-panel-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="pg-panel-body">{children}</div>
      </div>
    </div>
  );
}
