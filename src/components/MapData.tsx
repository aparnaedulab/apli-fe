import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import type {
  CollegeProgram,
  MappingScope,
  MappingStudent,
  Offered,
  ProgramChoice,
  StudentPage,
} from '../api/mapping';
import './MapData.css';

/**
 * One college's mapping, in two steps:
 *
 *   1. Courses & branches - which of the university's programmes it runs.
 *   2. Students           - which programme each of its students is in.
 *
 * Used by the university (for any college) and by the college (for itself).
 * The difference is only the scope it is handed.
 */
export default function MapData({
  scope,
  offered,
  collegeName,
  onChanged,
  only,
}: {
  scope: MappingScope;
  offered: Offered;
  collegeName: string;
  /** Called after any save, so a surrounding list can refresh its counts. */
  onChanged?: () => void;
  /** Show one half without tabs - how Set up walks through it step by step. */
  only?: 'programs' | 'students';
}) {
  const [tab, setTab] = useState<'programs' | 'students'>(only ?? 'programs');
  const [programs, setPrograms] = useState<CollegeProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await scope.programs();
      setPrograms(p);
      setError(null);
      // A college that already runs something is most likely here for its students.
      return p;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the programmes.');
      return null;
    }
  }, [scope]);

  useEffect(() => {
    setPrograms(null);
    setTab(only ?? 'programs');
    void load();
  }, [load, only]);

  const mappedTotal = (programs ?? []).reduce((n, p) => n + p.students, 0);

  return (
    <div className="mapdata">
      {!only && (
      <div className="md-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'programs'}
          className={`md-tab ${tab === 'programs' ? 'is-current' : ''}`}
          onClick={() => setTab('programs')}
        >
          <span className="md-tab-n">1</span>
          Courses &amp; branches
          <span className="md-tab-count">{programs?.length ?? '…'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'students'}
          className={`md-tab ${tab === 'students' ? 'is-current' : ''}`}
          onClick={() => setTab('students')}
          disabled={!programs || programs.length === 0}
          title={programs?.length === 0 ? 'Choose the courses and branches first' : undefined}
        >
          <span className="md-tab-n">2</span>
          Students
          <span className="md-tab-count">{mappedTotal}</span>
        </button>
      </div>
      )}

      {only === 'students' && programs?.length === 0 && (
        <p className="alert alert-warn">
          {collegeName} runs no courses yet. Map its courses and branches first, then its students.
        </p>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {!programs && !error && <p className="md-muted">Loading…</p>}

      {programs && tab === 'programs' && (
        <ProgramsEditor
          offered={offered}
          programs={programs}
          collegeName={collegeName}
          save={async (choices) => {
            const next = await scope.savePrograms(choices);
            setPrograms(next);
            onChanged?.();
            return next;
          }}
          onNext={only ? undefined : () => setTab('students')}
        />
      )}

      {programs && programs.length > 0 && tab === 'students' && (
        <StudentsMapper
          scope={scope}
          programs={programs}
          onChanged={() => {
            void load();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 - courses and branches                                               */
/* -------------------------------------------------------------------------- */

const keyOf = (courseId: string, branchId: string | null) => `${courseId}|${branchId ?? ''}`;

export function ProgramsEditor({
  offered,
  programs,
  collegeName,
  save,
  onNext,
  lede,
  withIntake = true,
  lockedLabel = (n: number) => `${n} students`,
  lockedTitle = 'Students are mapped here',
}: {
  offered: Offered;
  programs: CollegeProgram[];
  collegeName: string;
  save: (choices: ProgramChoice[]) => Promise<CollegeProgram[]>;
  onNext?: () => void;
  lede?: React.ReactNode;
  withIntake?: boolean;
  /** What locks a row, in words - students for a college, colleges for the university. */
  lockedLabel?: (n: number) => string;
  lockedTitle?: string;
}) {
  const initial = useMemo(() => new Set(programs.map((p) => keyOf(p.courseId, p.branchId))), [programs]);
  const byKey = useMemo(() => new Map(programs.map((p) => [keyOf(p.courseId, p.branchId), p])), [programs]);

  const [chosen, setChosen] = useState<Set<string>>(initial);
  const [intake, setIntake] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setChosen(new Set(initial));
    setIntake(
      Object.fromEntries(programs.map((p) => [keyOf(p.courseId, p.branchId), p.intake?.toString() ?? ''])),
    );
  }, [initial, programs]);

  const dirty =
    chosen.size !== initial.size ||
    [...chosen].some((k) => !initial.has(k)) ||
    programs.some((p) => (p.intake?.toString() ?? '') !== (intake[keyOf(p.courseId, p.branchId)] ?? ''));

  const courses = offered.courses.filter((c) => {
    const f = filter.trim().toLowerCase();
    if (!f) return true;
    return c.name.toLowerCase().includes(f) || c.branches.some((b) => b.name.toLowerCase().includes(f));
  });

  // Programmes the college runs that the university no longer offers. Shown,
  // so removing them is a visible choice rather than a silent side effect.
  const offeredKeys = new Set(
    offered.courses.flatMap((c) =>
      c.branches.length ? c.branches.map((b) => keyOf(c.id, b.id)) : [keyOf(c.id, null)],
    ),
  );
  const orphans = programs.filter((p) => !offeredKeys.has(keyOf(p.courseId, p.branchId)));

  function toggle(key: string) {
    if (byKey.get(key)?.students) return; // locked while students are in it
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCourse(keys: string[], on: boolean) {
    setChosen((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else if (!byKey.get(k)?.students) next.delete(k);
      }
      return next;
    });
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const choices: ProgramChoice[] = [...chosen].map((k) => {
        const [courseId, branchId] = k.split('|');
        const raw = intake[k]?.trim();
        return {
          courseId: courseId!,
          branchId: branchId || null,
          intake: raw ? Number.parseInt(raw, 10) : null,
        };
      });
      const next = await save(choices);
      const linked = next.reduce((n, p) => n + p.students, 0);
      setNote(
        `Saved. ${collegeName} runs ${next.length} course/branch pair${next.length === 1 ? '' : 's'}` +
          (linked && withIntake ? `, with ${linked} student${linked === 1 ? '' : 's'} mapped.` : '.'),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="md-pane">
      <p className="md-lede">
        {lede ?? (
          <>
            Tick what <b>{collegeName}</b> runs. Only the university's courses and branches are on offer
            here, so every college spells them the same way. Students already on the roster with a matching
            course and branch are mapped automatically when you save.
          </>
        )}
      </p>

      {offered.fromCatalogue && (
        <p className="alert alert-warn">
          The university has not picked its own courses yet, so the whole Apli.ai catalogue is shown. Pick
          them in Set up → Courses &amp; branches to keep this list short.
        </p>
      )}

      {offered.courses.length > 6 && (
        <input
          className="md-search"
          type="search"
          placeholder="Find a course or branch"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}

      {offered.courses.length === 0 && (
        <p className="md-muted">
          No courses to choose from. Add courses and branches in Set up → Lists first.
        </p>
      )}

      <div className="md-courses">
        {courses.map((c) => {
          const keys = c.branches.length ? c.branches.map((b) => keyOf(c.id, b.id)) : [keyOf(c.id, null)];
          const on = keys.filter((k) => chosen.has(k)).length;
          const all = on === keys.length;

          return (
            <fieldset key={c.id} className={`md-course ${on ? 'is-on' : ''}`}>
              <legend className="md-course-head">
                <label className="md-check">
                  <input
                    type="checkbox"
                    checked={all}
                    ref={(el) => {
                      if (el) el.indeterminate = on > 0 && !all;
                    }}
                    onChange={() => toggleCourse(keys, !all)}
                  />
                  <span className="md-course-name">{c.name}</span>
                </label>
                <span className="md-course-meta">
                  {c.branches.length
                    ? `${on} of ${c.branches.length} branch${c.branches.length === 1 ? '' : 'es'}`
                    : on
                      ? 'Runs this course'
                      : 'No branches'}
                </span>
              </legend>

              {c.branches.length > 0 && (
                <ul className="md-branches">
                  {c.branches.map((b) => {
                    const k = keyOf(c.id, b.id);
                    const existing = byKey.get(k);
                    const locked = !!existing?.students;
                    return (
                      <li key={b.id} className={chosen.has(k) ? 'is-on' : ''}>
                        <label className="md-check" title={locked ? lockedTitle : undefined}>
                          <input
                            type="checkbox"
                            checked={chosen.has(k)}
                            disabled={locked}
                            onChange={() => toggle(k)}
                          />
                          <span>{b.name}</span>
                        </label>
                        {chosen.has(k) && (
                          <span className="md-branch-side">
                            {existing?.students ? (
                              <span className="md-count">{lockedLabel(existing.students)}</span>
                            ) : null}
                            {withIntake && (
                            <input
                              className="md-intake"
                              inputMode="numeric"
                              placeholder="Seats"
                              aria-label={`Seats in ${c.name} ${b.name}`}
                              value={intake[k] ?? ''}
                              onChange={(e) =>
                                setIntake((v) => ({ ...v, [k]: e.target.value.replace(/\D/g, '') }))
                              }
                            />
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          );
        })}
      </div>

      {orphans.length > 0 && (
        <div className="md-orphans">
          <p className="md-label">No longer offered by the university</p>
          <ul className="md-branches">
            {orphans.map((p) => {
              const k = keyOf(p.courseId, p.branchId);
              return (
                <li key={p.id} className={chosen.has(k) ? 'is-on' : ''}>
                  <label className="md-check">
                    <input
                      type="checkbox"
                      checked={chosen.has(k)}
                      disabled={p.students > 0}
                      onChange={() => toggle(k)}
                    />
                    <span>
                      {p.course}
                      {p.branch ? ` – ${p.branch}` : ''}
                    </span>
                  </label>
                  {p.students > 0 && <span className="md-count">{lockedLabel(p.students)}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {note && <p className="alert alert-ok">{note}</p>}

      <footer className="md-foot">
        <span className="md-muted">
          {chosen.size} programme{chosen.size === 1 ? '' : 's'} ticked
          {dirty ? ' · unsaved changes' : ''}
        </span>
        <span className="md-foot-actions">
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {onNext && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onNext}
              disabled={dirty || programs.length === 0}
            >
              Next: Students →
            </button>
          )}
        </span>
      </footer>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 - students                                                           */
/* -------------------------------------------------------------------------- */

const PAGE = 50;

function StudentsMapper({
  scope,
  programs,
  onChanged,
}: {
  scope: MappingScope;
  programs: CollegeProgram[];
  onChanged: () => void;
}) {
  const [programId, setProgramId] = useState(programs[0]!.id);
  const program = programs.find((p) => p.id === programId) ?? programs[0]!;

  const [inside, setInside] = useState<StudentPage | null>(null);
  const [waiting, setWaiting] = useState<StudentPage | null>(null);
  const [insidePage, setInsidePage] = useState(1);
  const [waitingPage, setWaitingPage] = useState(1);
  const [q, setQ] = useState('');
  const [unplaced, setUnplaced] = useState(false);
  const [pickIn, setPickIn] = useState<Set<string>>(new Set());
  const [pickWait, setPickWait] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadInside = useCallback(async () => {
    setInside(await scope.students({ programId, status: 'mapped', page: insidePage, pageSize: PAGE }));
  }, [scope, programId, insidePage]);

  const loadWaiting = useCallback(async () => {
    setWaiting(
      await scope.students({
        status: 'unmapped',
        includeUnplaced: unplaced,
        q: q.trim() || undefined,
        page: waitingPage,
        pageSize: PAGE,
      }),
    );
  }, [scope, unplaced, q, waitingPage]);

  useEffect(() => {
    setPickIn(new Set());
    loadInside().catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load.'));
  }, [loadInside]);

  useEffect(() => {
    setPickWait(new Set());
    const t = setTimeout(() => {
      loadWaiting().catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load.'));
    }, 250);
    return () => clearTimeout(t);
  }, [loadWaiting]);

  const label = `${program.course}${program.branch ? ` – ${program.branch}` : ''}`;

  async function act(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      setNote(await fn());
      setPickIn(new Set());
      setPickWait(new Set());
      await Promise.all([loadInside(), loadWaiting()]);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const onMap = () =>
    act(async () => {
      const r = await scope.map(program.id, [...pickWait]);
      const skipped = r.skipped.length
        ? ` ${r.skipped.length} skipped: ${r.skipped
            .slice(0, 3)
            .map((s) => `${s.name} (${s.reason})`)
            .join('; ')}${r.skipped.length > 3 ? '…' : ''}`
        : '';
      return `${r.mapped} mapped to ${label}.${skipped}`;
    });

  const onUnmap = () =>
    act(async () => {
      const r = await scope.unmap([...pickIn]);
      return `${r.unmapped} taken out of ${label}. They are still on the college roster.`;
    });

  return (
    <section className="md-pane md-students">
      <div className="md-programs" role="listbox" aria-label="Programmes">
        <p className="md-label">Programmes</p>
        {programs.map((p) => (
          <button
            key={p.id}
            type="button"
            role="option"
            aria-selected={p.id === program.id}
            className={`md-program ${p.id === program.id ? 'is-current' : ''}`}
            onClick={() => {
              setProgramId(p.id);
              setInsidePage(1);
            }}
          >
            <span className="md-program-name">
              {p.course}
              {p.branch && <span className="md-program-branch">{p.branch}</span>}
            </span>
            <span className="md-count">
              {p.students}
              {p.intake ? ` / ${p.intake}` : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="md-lists">
        {error && <p className="alert alert-error">{error}</p>}
        {note && <p className="alert alert-ok">{note}</p>}

        <StudentList
          title={`In ${label}`}
          empty="Nobody mapped here yet. Pick students from the list below."
          page={inside}
          picked={pickIn}
          setPicked={setPickIn}
          onPage={setInsidePage}
          action={
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || pickIn.size === 0}
              onClick={onUnmap}
            >
              Take out {pickIn.size || ''}
            </button>
          }
        />

        <StudentList
          title="Waiting to be mapped"
          empty={q ? 'Nobody matches that search.' : 'Every student here is mapped.'}
          page={waiting}
          picked={pickWait}
          setPicked={setPickWait}
          onPage={setWaitingPage}
          showCollege={unplaced}
          tools={
            <>
              <input
                className="md-search"
                type="search"
                placeholder="Search name, email or PRN"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setWaitingPage(1);
                }}
              />
              {scope.canSeeUnplaced && (
                <label className="md-check md-toggle">
                  <input
                    type="checkbox"
                    checked={unplaced}
                    onChange={(e) => {
                      setUnplaced(e.target.checked);
                      setWaitingPage(1);
                    }}
                  />
                  <span>Include students not in any college yet</span>
                </label>
              )}
            </>
          }
          action={
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || pickWait.size === 0}
              onClick={onMap}
            >
              Map {pickWait.size || ''} to {label}
            </button>
          }
        />
      </div>
    </section>
  );
}

function StudentList({
  title,
  empty,
  page,
  picked,
  setPicked,
  onPage,
  tools,
  action,
  showCollege,
}: {
  title: string;
  empty: string;
  page: StudentPage | null;
  picked: Set<string>;
  setPicked: (s: Set<string>) => void;
  onPage: (n: number) => void;
  tools?: React.ReactNode;
  action: React.ReactNode;
  showCollege?: boolean;
}) {
  const rows = page?.rows ?? [];
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;

  function flip(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  return (
    <div className="md-list">
      <header className="md-list-head">
        <h3>
          {title} <span className="md-count">{page?.total ?? '…'}</span>
        </h3>
        {action}
      </header>
      {tools && <div className="md-list-tools">{tools}</div>}

      {!page && <p className="md-muted">Loading…</p>}
      {page && rows.length === 0 && <p className="md-muted">{empty}</p>}

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
              <th>PRN / Roll</th>
              <th>{showCollege ? 'College' : 'Batch'}</th>
              <th>Course on record</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: MappingStudent) => (
              <tr key={r.id} className={picked.has(r.id) ? 'is-picked' : ''} onClick={() => flip(r.id)}>
                <td className="md-col-check">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={picked.has(r.id)}
                    onChange={() => flip(r.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td>
                  <span className="md-name">{r.name}</span>
                  <span className="md-sub">{r.email}</span>
                </td>
                <td className="md-mono">{r.prn ?? r.rollNo ?? '—'}</td>
                <td>
                  {showCollege
                    ? (r.college?.code ?? <span className="pill pill-hold">No college</span>)
                    : r.batches.join(', ') || '—'}
                </td>
                <td className="md-sub">
                  {[r.course, r.branch].filter(Boolean).join(' – ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {page && pages > 1 && (
        <nav className="md-pager" aria-label={`${title} pages`}>
          <button type="button" className="btn btn-ghost" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)}>
            ← Previous
          </button>
          <span className="md-muted">
            Page {page.page} of {pages}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={page.page >= pages}
            onClick={() => onPage(page.page + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
