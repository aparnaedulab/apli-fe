import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import MapData from '../../components/MapData';
import MappingSummary from '../../components/MappingSummary';
import { ApiError } from '../../api/client';
import {
  adminMapping,
  type CollegeProgram,
  type MappingCollege,
  type Offered,
  type StudentPage,
} from '../../api/mapping';
import '../../components/MapData.css';
import './MapDataPage.css';

/**
 * Map data, for the university.
 *
 * Colleges, courses, branches and students are onboarded on their own in Set
 * up. This is where they are tied together: pick a college, tick the courses
 * and branches it runs, then put its students into them.
 */
export default function MapDataPage() {
  const [colleges, setColleges] = useState<MappingCollege[] | null>(null);
  const [offered, setOffered] = useState<Offered | null>(null);
  const [unplaced, setUnplaced] = useState(0);
  const [selected, setSelected] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminMapping.overview();
      setColleges(r.colleges);
      setOffered(r.offered);
      setUnplaced(r.unplacedStudents);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the colleges.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const college = colleges?.find((c) => c.id === selected);
  const scope = useMemo(() => (selected && selected !== 'unplaced' ? adminMapping.forCollege(selected) : null), [selected]);

  const totals = useMemo(() => {
    const list = colleges ?? [];
    return {
      colleges: list.length,
      withPrograms: list.filter((c) => c.programs > 0).length,
      students: list.reduce((n, c) => n + c.students, 0) + unplaced,
      mapped: list.reduce((n, c) => n + c.mapped, 0),
    };
  }, [colleges, unplaced]);

  const shown = (colleges ?? []).filter((c) => {
    const f = filter.trim().toLowerCase();
    return !f || c.name.toLowerCase().includes(f) || c.code.toLowerCase().includes(f);
  });

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <h1>Map data</h1>
          <p className="page-lede">
            Tie together what the university onboarded: each college to the courses and branches it runs, and
            each student to one of them.
          </p>
        </div>
        <Link to="/admin/setup" className="btn btn-secondary">
          Onboard data in Set up
        </Link>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {colleges && (
        <div className="mdp-tiles">
          <Tile value={`${totals.withPrograms} / ${totals.colleges}`} label="Colleges with courses mapped" />
          <Tile value={`${totals.mapped} / ${totals.students}`} label="Students mapped" />
          <Tile value={String(unplaced)} label="Students not in a college" warn={unplaced > 0} />
        </div>
      )}

      <div className="mdp">
        <nav className="mdp-rail" aria-label="Colleges">
          {(colleges?.length ?? 0) > 8 && (
            <input
              type="search"
              className="mdp-filter"
              placeholder="Find a college"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}

          {unplaced > 0 && (
            <button
              type="button"
              className={`mdp-college is-unplaced ${selected === 'unplaced' ? 'is-current' : ''}`}
              onClick={() => setSelected('unplaced')}
            >
              <span className="mdp-college-name">Not in a college yet</span>
              <span className="mdp-college-meta">{unplaced} students waiting</span>
            </button>
          )}

          {colleges === null && <p className="md-muted">Loading…</p>}
          {colleges?.length === 0 && (
            <p className="md-muted">
              No colleges yet. <Link to="/admin/setup">Add them in Set up</Link> first.
            </p>
          )}

          {shown.map((c) => {
            const pct = c.students ? Math.round((c.mapped / c.students) * 100) : 0;
            return (
              <button
                key={c.id}
                type="button"
                className={`mdp-college ${selected === c.id ? 'is-current' : ''}`}
                onClick={() => setSelected(c.id)}
              >
                <span className="mdp-college-name">
                  {c.name} <span className="mdp-code">{c.code}</span>
                </span>
                <span className="mdp-college-meta">
                  {c.programs ? `${c.programs} programme${c.programs === 1 ? '' : 's'}` : 'No courses yet'} ·{' '}
                  {c.mapped}/{c.students} students
                </span>
                <span className="mdp-bar" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
              </button>
            );
          })}
        </nav>

        <section className="mdp-main">
          {!selected && colleges && (
            <>
              <header className="mdp-head">
                <h2>Mapped so far</h2>
              </header>
              <p className="md-muted">Choose a college on the left to change its courses or students.</p>
              <MappingSummary load={adminMapping.summary} allColleges={colleges} onEdit={setSelected} />
            </>
          )}

          {selected === 'unplaced' && colleges && (
            <UnplacedPane colleges={colleges} onChanged={load} />
          )}

          {scope && college && offered && (
            <>
              <header className="mdp-head">
                <h2>{college.name}</h2>
                <Link to={`/admin/colleges/${college.id}`} className="mdp-open">
                  Open college →
                </Link>
              </header>
              <MapData
                key={college.id}
                scope={scope}
                offered={offered}
                collegeName={college.code}
                onChanged={load}
              />
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

function Tile({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div className={`mdp-tile ${warn ? 'is-warn' : ''}`}>
      <p className="mdp-tile-value">{value}</p>
      <p className="mdp-tile-label">{label}</p>
    </div>
  );
}

/**
 * Students the university uploaded without a college. Choose where they go -
 * a college and one of its programmes - and they join that college's roster.
 */
function UnplacedPane({ colleges, onChanged }: { colleges: MappingCollege[]; onChanged: () => void }) {
  const [collegeId, setCollegeId] = useState('');
  const [programs, setPrograms] = useState<CollegeProgram[] | null>(null);
  const [programId, setProgramId] = useState('');
  const [page, setPage] = useState<StudentPage | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    setPage(await adminMapping.unplaced({ q: q.trim() || undefined, page: pageNo, pageSize: 50 }));
  }, [q, pageNo]);

  useEffect(() => {
    setPicked(new Set());
    const t = setTimeout(() => {
      loadStudents().catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load.'));
    }, 250);
    return () => clearTimeout(t);
  }, [loadStudents]);

  useEffect(() => {
    setPrograms(null);
    setProgramId('');
    if (!collegeId) return;
    adminMapping
      .forCollege(collegeId)
      .programs()
      .then(setPrograms)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the programmes.'));
  }, [collegeId]);

  async function onMap() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await adminMapping.forCollege(collegeId).map(programId, [...picked]);
      const college = colleges.find((c) => c.id === collegeId);
      setNote(
        `${r.mapped} moved into ${college?.code ?? 'the college'}.` +
          (r.skipped.length ? ` ${r.skipped.length} skipped: ${r.skipped.map((s) => s.reason).join('; ')}` : ''),
      );
      setPicked(new Set());
      await loadStudents();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not map them.');
    } finally {
      setBusy(false);
    }
  }

  const rows = page?.rows ?? [];
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;

  return (
    <div className="md-pane">
      <header className="mdp-head">
        <h2>Not in a college yet</h2>
      </header>
      <p className="md-lede">
        These students were added at university level with no college. Tick them, choose their college and
        programme, and they move onto that college's roster.
      </p>

      <div className="mdp-target">
        <label>
          <span className="md-label">College</span>
          <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>
            <option value="">Choose a college</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="md-label">Course and branch</span>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            disabled={!programs || programs.length === 0}
          >
            <option value="">
              {!collegeId ? 'Choose a college first' : programs?.length === 0 ? 'This college has no courses yet' : 'Choose'}
            </option>
            {programs?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.course}
                {p.branch ? ` – ${p.branch}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !programId || picked.size === 0}
          onClick={onMap}
        >
          Map {picked.size || ''} student{picked.size === 1 ? '' : 's'}
        </button>
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {note && <p className="alert alert-ok">{note}</p>}

      <div className="md-list">
        <div className="md-list-tools">
          <input
            className="md-search"
            type="search"
            placeholder="Search name, email or PRN"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPageNo(1);
            }}
          />
          <span className="md-count">{page?.total ?? '…'}</span>
        </div>

        {page && rows.length === 0 && <p className="md-muted">Nobody waiting.</p>}
        {rows.length > 0 && (
          <table className="md-table">
            <thead>
              <tr>
                <th className="md-col-check">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOn}
                    onChange={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
                  />
                </th>
                <th>Student</th>
                <th>PRN</th>
                <th>Course on record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={picked.has(r.id) ? 'is-picked' : ''}
                  onClick={() => {
                    const next = new Set(picked);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    setPicked(next);
                  }}
                >
                  <td className="md-col-check">
                    <input type="checkbox" readOnly checked={picked.has(r.id)} aria-label={`Select ${r.name}`} />
                  </td>
                  <td>
                    <span className="md-name">{r.name}</span>
                    <span className="md-sub">{r.email}</span>
                  </td>
                  <td className="md-mono">{r.prn ?? '—'}</td>
                  <td className="md-sub">{[r.course, r.branch].filter(Boolean).join(' – ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {page && pages > 1 && (
          <nav className="md-pager">
            <button type="button" className="btn btn-ghost" disabled={pageNo <= 1} onClick={() => setPageNo(pageNo - 1)}>
              ← Previous
            </button>
            <span className="md-muted">
              Page {pageNo} of {pages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pageNo >= pages}
              onClick={() => setPageNo(pageNo + 1)}
            >
              Next →
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
