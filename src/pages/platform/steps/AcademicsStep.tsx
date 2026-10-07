import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type Catalogue } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { Chip, StepFooter } from '../ui';
import { BulkBranches, BulkCourses } from './BulkAdd';

/** Selected courses: course id → chosen branch (specialisation) ids; empty = the whole course. */
type Selection = Map<string, Set<string>>;
type Course = Catalogue['courses'][number];
type Branch = Catalogue['branches'][number];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * What the institution teaches.
 *
 * One idea per screen: a grid of every course on the platform, and a tick on
 * the ones this institution runs. A ticked course runs all of its branches
 * unless somebody narrows it, and narrowing happens in a dialog with one
 * checkbox per branch - so the page itself never turns into a wall of chips.
 *
 * Branches are one master list for the whole platform, so the same branch is
 * spelt the same way everywhere. That list is managed at the foot of the step,
 * folded, because it is rarely needed.
 */
export default function AcademicsStep({ state, catalogue, onSaved, goto, updateCatalogue }: StepProps) {
  const t = state!.tenant;
  // Placement rules are hidden on this step for now (see the comment further
  // down). Their saved values are still sent back unchanged on save.
  const oneOffer = t.oneOfferDefault;
  const selfJoin = t.allowSelfJoin;
  const responseDays = t.responseDays ?? 7;
  const companyApproval = t.companyApprovalRequired ?? false;
  const unverifiedAccess = t.unverifiedCompanyAccess ?? false;

  const [picked, setPicked] = useState<Selection>(
    () => new Map(state!.programs.map((p) => [p.courseId, new Set(p.specialisationIds)])),
  );
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'picked'>('all');
  /** The course whose branches are being chosen, in the dialog. */
  const [editing, setEditing] = useState<string | null>(null);
  const [addingCourse, setAddingCourse] = useState(false);
  const [bulkCourses, setBulkCourses] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branchesRef = useRef<HTMLElement>(null);
  /** The shared branch list, folded away until somebody needs it. */
  const [showBranches, setShowBranches] = useState(false);

  const courses = catalogue.courses;
  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter((c) => show === 'all' || picked.has(c.id))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.specialisations.some((s) => s.name.toLowerCase().includes(q)),
      );
  }, [courses, picked, query, show]);

  const allShownOn = shown.length > 0 && shown.every((c) => picked.has(c.id));
  const someShownOn = shown.some((c) => picked.has(c.id));

  /** Tick or untick every course the current search and filter show. */
  function setShownCourses(on: boolean) {
    setPicked((m) => {
      const next = new Map(m);
      for (const c of shown) {
        if (on && !next.has(c.id)) next.set(c.id, new Set());
        if (!on) next.delete(c.id);
      }
      return next;
    });
  }

  const exact = courses.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  function putCourse(course: Course) {
    updateCatalogue((cat) => ({ ...cat, courses: [...cat.courses.filter((c) => c.id !== course.id), course].sort(byName) }));
  }

  function putBranch(branch: Branch) {
    updateCatalogue((cat) => ({ ...cat, branches: [...cat.branches.filter((b) => b.id !== branch.id), branch].sort(byName) }));
  }

  function add(id: string) {
    setPicked((m) => new Map(m).set(id, new Set()));
  }

  function toggleCourse(id: string) {
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(id)) next.delete(id);
      else next.set(id, new Set());
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (picked.size === 0) {
      setError('Tick at least one course they run.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await platformApi.saveAcademics(t.id, {
        oneOfferDefault: oneOffer,
        allowSelfJoin: selfJoin,
        responseDays,
        companyApprovalRequired: companyApproval,
        unverifiedCompanyAccess: unverifiedAccess,
        programs: [...picked].map(([courseId, set]) => ({ courseId, specialisationIds: [...set] })),
      });
      onSaved(next, 'colleges');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const branchCount = [...picked.values()].reduce((n, s) => n + s.size, 0);
  const editingCourse = editing ? byId.get(editing) : undefined;

  return (
    <form onSubmit={submit} noValidate>
      <section className="blk cg-blk">
        {/* One line of tools: what to do, a filter, and the two ways to add
            a course that is not in the list. */}
        <div className="cg-bar">
          <div className="cg-tabs" role="tablist" aria-label="Which courses to show">
            <button
              type="button"
              role="tab"
              aria-selected={show === 'all'}
              className={show === 'all' ? 'is-on' : ''}
              onClick={() => setShow('all')}
            >
              All courses <span>{courses.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={show === 'picked'}
              className={show === 'picked' ? 'is-on' : ''}
              onClick={() => setShow('picked')}
            >
              Ticked <span>{picked.size}</span>
            </button>
          </div>

          <div className="search cg-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a course or branch"
              aria-label="Find a course or branch"
            />
          </div>

          <span className="cg-tools">
            {!bulkCourses && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBulkCourses(true)}>
                Upload from Excel
              </button>
            )}
            {!addingCourse && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddingCourse(true)}>
                + New course
              </button>
            )}
          </span>
        </div>

        {bulkCourses && (
          <BulkCourses
            onClose={() => setBulkCourses(false)}
            onDone={(saved, allBranches) => {
              updateCatalogue((cat) => ({
                ...cat,
                branches: allBranches,
                courses: [...cat.courses.filter((c) => !saved.some((s) => s.id === c.id)), ...saved].sort(byName),
              }));
              // Everything just added is something this institution runs.
              setPicked((m) => {
                const next = new Map(m);
                for (const c of saved) if (!next.has(c.id)) next.set(c.id, new Set());
                return next;
              });
              setBulkCourses(false);
            }}
          />
        )}

        {addingCourse && (
          <NewCourse
            initialName={exact ? '' : query.trim()}
            branches={catalogue.branches}
            onFindBranch={() => {
              setShowBranches(true);
              branchesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onCancel={() => setAddingCourse(false)}
            onAdded={(course) => {
              putCourse(course);
              add(course.id);
              setQuery('');
              setAddingCourse(false);
            }}
          />
        )}

        {/*
          The courses, as a table: a row each, a tick to say they run it.
          A table because the catalogue grows - at fifty or a hundred
          courses, rows scan and cards do not. The header stays put while
          the body scrolls.
        */}
        {shown.length > 0 ? (
          <div className="ct-wrap">
            <table className="ct">
              <thead>
                <tr>
                  <th className="ct-tick">
                    <input
                      type="checkbox"
                      aria-label={allShownOn ? 'Untick every course shown' : 'Tick every course shown'}
                      checked={allShownOn}
                      ref={(el) => {
                        if (el) el.indeterminate = someShownOn && !allShownOn;
                      }}
                      onChange={() => setShownCourses(!allShownOn)}
                    />
                  </th>
                  <th>Course</th>
                  <th>Branches it runs</th>
                  <th className="ct-num">Available</th>
                  <th className="ct-act">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const chosen = picked.get(c.id);
                  const on = Boolean(chosen);
                  const total = c.specialisations.length;
                  const names = c.specialisations.filter((s) => chosen?.has(s.id)).map((s) => s.name);
                  const runs = !on
                    ? '—'
                    : total === 0
                      ? 'Whole course'
                      : chosen!.size === 0
                        ? 'All branches'
                        : names.length > 3
                          ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more`
                          : names.join(', ');
                  return (
                    <tr key={c.id} className={on ? 'is-on' : ''} onClick={() => toggleCourse(c.id)}>
                      <td className="ct-tick">
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={`${c.name} runs here`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleCourse(c.id)}
                        />
                      </td>
                      <td className="ct-name">{c.name}</td>
                      <td className={`ct-runs ${on && chosen!.size === 0 && total > 0 ? 'is-all' : ''}`}>{runs}</td>
                      <td className="ct-num">{total || '—'}</td>
                      <td className="ct-act">
                        {on && total > 0 && (
                          <button
                            type="button"
                            className="linkish"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(c.id);
                            }}
                          >
                            Choose branches
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cg-empty">
            {show === 'picked' && !query ? (
              <p>Nothing ticked yet. Tick the courses this institution runs under “All courses”.</p>
            ) : query.trim().length >= 2 && !exact ? (
              <p>
                No course called “{query.trim()}”.{' '}
                <button type="button" className="linkish" onClick={() => setAddingCourse(true)}>
                  Add it as a new course
                </button>
              </p>
            ) : (
              <p>No courses yet. Use “New course” to add the first.</p>
            )}
          </div>
        )}
      </section>

      {editingCourse && (
        <BranchDialog
          course={editingCourse}
          chosen={picked.get(editingCourse.id) ?? new Set()}
          onChange={(next) => setPicked((m) => new Map(m).set(editingCourse.id, next))}
          onClose={() => setEditing(null)}
          attach={
            <AttachBranches
              course={editingCourse}
              branches={catalogue.branches}
              onAttached={(updated) => {
                putCourse(updated);
                // A branch attached here is one this institution offers.
                const chosen = picked.get(editingCourse.id) ?? new Set<string>();
                const before = new Set(editingCourse.specialisations.map((s) => s.id));
                const fresh = updated.specialisations.filter((s) => !before.has(s.id)).map((s) => s.id);
                if (chosen.size > 0) {
                  setPicked((m) => new Map(m).set(editingCourse.id, new Set([...chosen, ...fresh])));
                }
              }}
            />
          }
        />
      )}

      {/*
        The shared branch list.

        Every institution picks branches from one catalogue, so each branch
        has exactly one spelling. Managing it is a rare job, so it lives here,
        folded - and opens itself when somebody adding a course goes looking
        for a branch that is missing.
      */}
      <section className="blk blk-quiet" ref={branchesRef}>
        <button
          type="button"
          className="blk-fold"
          onClick={() => setShowBranches((v) => !v)}
          aria-expanded={showBranches}
        >
          Branch list
          <small>Shared by every institution, so each branch has one spelling</small>
        </button>

        {showBranches && (
          <BranchManager branches={catalogue.branches} courses={courses} onAdded={putBranch} />
        )}
      </section>

      {/*
        Placement rules - hidden for now to keep this step to courses alone.
        The saved values are read from the tenant above and sent back
        unchanged, so hiding the section changes nothing that is stored. The
        previous version of this step with the rules section is in git history
        / the scratchpad backup; to bring it back, restore the state hooks and
        the <Toggle> block.
      */}

      <StepFooter
        busy={busy}
        error={error}
        onBack={() => goto('identity')}
        submitLabel="Save & continue"
        note={picked.size > 0 ? `${picked.size} course${picked.size === 1 ? '' : 's'}${branchCount ? ` · ${branchCount} branches` : ''}` : null}
      />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Choosing a course's branches                                                */
/* -------------------------------------------------------------------------- */

/**
 * A dialog for one course's branches: "all of them" or a checkbox each. In
 * its own focused box, so the grid behind it stays a grid of course names.
 */
function BranchDialog({
  course,
  chosen,
  onChange,
  onClose,
  attach,
}: {
  course: Course;
  chosen: Set<string>;
  /** The new selection; empty means every branch. */
  onChange: (next: Set<string>) => void;
  onClose: () => void;
  attach: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const all = chosen.size === 0;
  const ids = course.specialisations.map((s) => s.id);

  /** Untick one of "all" and the rest stay; tick the last one back and it is "all" again. */
  function flip(id: string) {
    const next = new Set(all ? ids : chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // None ticked is not a choice anybody means; keep at least one.
    if (next.size === 0) return;
    onChange(next.size === ids.length ? new Set() : next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bd-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="bd"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-title"
        tabIndex={-1}
        ref={box}
      >
        <div className="bd-head">
          <div>
            <h2 id="bd-title">{course.name} branches</h2>
            <p>Which branches of {course.name} does this institution run?</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label className={`bd-all ${all ? 'is-on' : ''}`}>
          <input type="checkbox" checked={all} onChange={() => !all && onChange(new Set())} />
          <span>
            <strong>All branches</strong>
            <small>{all ? 'Untick any branch below to run only some' : `${chosen.size} of ${ids.length} chosen`}</small>
          </span>
        </label>

        <div className="bd-list">
          {course.specialisations.map((s) => (
            <label key={s.id} className={`bd-opt ${all || chosen.has(s.id) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={all || chosen.has(s.id)} onChange={() => flip(s.id)} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>

        <div className="bd-foot">
          <div className="bd-attach">{attach}</div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The master branch list                                                      */
/* -------------------------------------------------------------------------- */

/** How many chips are shown before the list asks to be opened. */
const BRANCH_PREVIEW = 24;

function BranchManager({
  branches,
  courses,
  onAdded,
}: {
  branches: Branch[];
  courses: Course[];
  onAdded: (b: Branch) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Branch[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [showAll, setShowAll] = useState(false);
  /** Added in this sitting, newest first - the answer to "did that work?". */
  const [recent, setRecent] = useState<string[]>([]);

  const q = name.trim().toLowerCase();
  const filtered = q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches;

  /**
   * How many courses carry each branch.
   *
   * A master list is only trustworthy if you can see what is actually being
   * used, and it is the count that makes a duplicate obvious: two spellings of
   * Computer Engineering, one on nine courses and one on none, is a mistake
   * you can see rather than one you have to go looking for.
   */
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of courses) for (const s of c.specialisations) m.set(s.branchId, (m.get(s.branchId) ?? 0) + 1);
    return m;
  }, [courses]);

  /** What was just added floats to the top; the rest stays alphabetical. */
  const ordered = useMemo(() => {
    const rank = new Map(recent.map((id, i) => [id, i]));
    return [...filtered].sort((a, b) => {
      const ra = rank.get(a.id) ?? Infinity;
      const rb = rank.get(b.id) ?? Infinity;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, recent]);

  // While searching, show every match - a hidden match reads as "not there",
  // which is exactly how a duplicate gets added.
  const shown = showAll || q ? ordered : ordered.slice(0, BRANCH_PREVIEW);
  const hidden = ordered.length - shown.length;

  function highlight(id: string) {
    setFlash(id);
    setRecent((r) => [id, ...r.filter((x) => x !== id)]);
    window.setTimeout(() => setFlash(null), 1600);
  }

  async function addBranch(confirm = false) {
    const value = name.trim();
    if (value.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const { branch, existed } = await platformApi.addBranch(value, confirm);
      onAdded(branch);
      highlight(branch.id);
      setName('');
      setSimilar(null);
      if (existed) setError(`${branch.name} is already on the list.`);
    } catch (err) {
      const details = (err as ApiError & { details?: { code?: string; similar?: Branch[] } }).details;
      if (err instanceof ApiError && details?.code === 'SIMILAR_BRANCH' && details.similar) {
        setSimilar(details.similar);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not add that branch.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="branches">
      <div className="branch-add">
        <input
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSimilar(null);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void addBranch();
            }
          }}
          placeholder="Type to search, or add a branch - e.g. Computer Engineering"
          aria-label="Search or add a branch"
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void addBranch()} disabled={busy || name.trim().length < 2}>
          {busy ? 'Adding…' : 'Add branch'}
        </button>
        {!bulk && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBulk(true)}>
            Bulk upload (Excel)
          </button>
        )}
      </div>

      {bulk && (
        <BulkBranches
          onClose={() => setBulk(false)}
          onAdded={(b) => {
            onAdded(b);
            highlight(b.id);
          }}
        />
      )}

      {similar && (
        <div className="notice notice-warn ob-in" role="alert">
          <span>
            <strong>Is this a spelling of one we already have?</strong> “{name.trim()}” looks like{' '}
            {similar.map((s) => s.name).join(', ')}.
          </span>
          <span className="notice-actions">
            {similar.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setName('');
                  setSimilar(null);
                  highlight(s.id);
                }}
              >
                Use “{s.name}”
              </button>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void addBranch(true)}>
              No, add “{name.trim()}”
            </button>
          </span>
        </div>
      )}
      {error && <p className="f-hint">{error}</p>}

      {/* The list as a thing you can actually read: what is on it, how many,
          which ones you just added, and which are carrying any courses. It
          used to be an undifferentiated wall of chips in a 180px box. */}
      <div className="list-panel">
        <div className="list-panel-head">
          <h3>
            On the list
            <span className="count">{branches.length}</span>
          </h3>
          {q ? (
            <p className="muted">
              {ordered.length} match{ordered.length === 1 ? '' : 'es'} for “{name.trim()}”
            </p>
          ) : (
            recent.length > 0 && (
              <p className="muted">
                {recent.length} added just now{recent.length > 1 ? ', newest first' : ''}
              </p>
            )
          )}
        </div>

        <div className="chips branch-list">
          {shown.map((b) => {
            const used = usage.get(b.id) ?? 0;
            const isNew = recent.includes(b.id);
            return (
              <span
                key={b.id}
                className={`chip is-static ${flash === b.id ? 'is-flash' : ''} ${isNew ? 'is-new' : ''}`}
                title={used ? `On ${used} course${used === 1 ? '' : 's'}` : 'Not on any course yet'}
              >
                {b.name}
                <small>{used || '–'}</small>
              </span>
            );
          })}

          {branches.length === 0 && <p className="muted">No branches yet. Add the first one above.</p>}
          {branches.length > 0 && ordered.length === 0 && (
            <p className="muted">No branch matches - press Enter to add it.</p>
          )}
        </div>

        {hidden > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>
            Show all {ordered.length} branches
          </button>
        )}
        {showAll && !q && ordered.length > BRANCH_PREVIEW && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(false)}>
            Show fewer
          </button>
        )}

        <p className="list-panel-foot muted">
          The number on each branch is how many courses carry it. A branch on none is either new or a
          second spelling of one already here.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Choosing branches for a course                                              */
/* -------------------------------------------------------------------------- */

/** Chips for every master branch, with a filter. Nothing is typed into the course. */
function BranchPicker({
  branches,
  selected,
  onToggle,
  exclude = new Set<string>(),
}: {
  branches: Branch[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  exclude?: Set<string>;
}) {
  const [filter, setFilter] = useState('');
  const shown = branches
    .filter((b) => !exclude.has(b.id))
    .filter((b) => !filter.trim() || b.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div className="branch-picker">
      {branches.length > 8 && (
        <input className="input input-sm" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter branches" />
      )}
      <div className="chips">
        {shown.map((b) => (
          <Chip key={b.id} on={selected.has(b.id)} onClick={() => onToggle(b.id)}>
            {b.name}
          </Chip>
        ))}
        {shown.length === 0 && <span className="muted">No branches to choose.</span>}
      </div>
    </div>
  );
}

function NewCourse({
  initialName,
  branches,
  onFindBranch,
  onCancel,
  onAdded,
}: {
  initialName: string;
  branches: Branch[];
  onFindBranch: () => void;
  onCancel: () => void;
  onAdded: (course: Course) => void;
}) {
  const [name, setName] = useState(initialName);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (name.trim().length < 2) {
      setError('Enter the course name, for example B.Tech.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { course } = await platformApi.addCourse(name.trim(), [...chosen]);
      onAdded(course);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that course.');
      setBusy(false);
    }
  }

  return (
    <div className="new-course ob-in">
      <p className="invite-card-title">Add a new course</p>
      <label className="f">
        <span className="f-label">Course name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="B.Tech, MBA, B.Com…"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
          }}
        />
      </label>
      <div className="f">
        <span className="f-label">
          Branches <span className="f-optional">optional · {chosen.size} chosen</span>
        </span>
        <BranchPicker
          branches={branches}
          selected={chosen}
          onToggle={(id) =>
            setChosen((s) => {
              const n = new Set(s);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            })
          }
        />
        <span className="f-hint">
          Missing a branch?{' '}
          <button type="button" className="linkish" onClick={onFindBranch}>
            Add it to the branch list first
          </button>
          .
        </span>
      </div>
      {error && (
        <p className="f-error" role="alert">
          {error}
        </p>
      )}
      <div className="invite-card-foot">
        <span className="f-hint">It joins the shared course list, so other institutions can pick it too.</span>
        <span className="new-course-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? 'Adding…' : 'Add course'}
          </button>
        </span>
      </div>
    </div>
  );
}

/** "+ Add branch" on a course card: offer more master branches under this course. */
function AttachBranches({
  course,
  branches,
  onAttached,
}: {
  course: Course;
  branches: Branch[];
  onAttached: (course: Course) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const have = new Set(course.specialisations.map((s) => s.branchId));

  if (!open) {
    return (
      <button type="button" className="chip chip-add" onClick={() => setOpen(true)}>
        + Add branch
      </button>
    );
  }

  async function attach() {
    if (chosen.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { course: updated } = await platformApi.attachBranches(course.id, [...chosen]);
      onAttached(updated);
      setOpen(false);
      setChosen(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add those branches.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="attach ob-in">
      <BranchPicker
        branches={branches}
        exclude={have}
        selected={chosen}
        onToggle={(id) =>
          setChosen((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          })
        }
      />
      {error && <p className="f-error">{error}</p>}
      <div className="new-course-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={attach} disabled={busy || chosen.size === 0}>
          {busy ? 'Adding…' : `Add ${chosen.size || ''} to ${course.name}`}
        </button>
      </div>
    </div>
  );
}
