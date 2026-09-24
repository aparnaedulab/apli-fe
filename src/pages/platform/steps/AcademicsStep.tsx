import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type Catalogue } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { Chip, StepFooter, Toggle } from '../ui';
import { BulkBranches, BulkCourses } from './BulkAdd';

/** Selected courses: course id → chosen branch (specialisation) ids; empty = the whole course. */
type Selection = Map<string, Set<string>>;
type Course = Catalogue['courses'][number];
type Branch = Catalogue['branches'][number];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * What the institution teaches - branches first, then courses.
 *
 * Branches are one master list for the whole platform. They are defined once
 * ("Computer Engineering"), and a course only ever picks from that list, so the
 * same branch is spelt the same way under B.Tech, M.Tech and at every
 * institution. Adding a branch is where spelling is checked: a look-alike of an
 * existing one ("Comp Engg") is flagged before it can be added.
 */
export default function AcademicsStep({ state, catalogue, onSaved, goto, updateCatalogue }: StepProps) {
  const t = state!.tenant;
  const [oneOffer, setOneOffer] = useState(t.oneOfferDefault);
  const [selfJoin, setSelfJoin] = useState(t.allowSelfJoin);
  const [responseDays, setResponseDays] = useState(t.responseDays ?? 7);
  const [companyApproval, setCompanyApproval] = useState(t.companyApprovalRequired ?? false);
  const [unverifiedAccess, setUnverifiedAccess] = useState(t.unverifiedCompanyAccess ?? false);
  const [picked, setPicked] = useState<Selection>(
    () => new Map(state!.programs.map((p) => [p.courseId, new Set(p.specialisationIds)])),
  );
  const [query, setQuery] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [bulkCourses, setBulkCourses] = useState(false);
  /** Show the whole catalogue rather than only what a search turned up. */
  const [browse, setBrowse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branchesRef = useRef<HTMLElement>(null);

  const courses = catalogue.courses;
  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter((c) => !picked.has(c.id))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.specialisations.some((s) => s.name.toLowerCase().includes(q)),
      );
  }, [courses, picked, query]);

  // Twelve is enough to answer a search. Browsing is a different question -
  // "what is there?" - and a truncated answer to that is a wrong one.
  const matches = browse ? available : available.slice(0, 12);

  const exact = courses.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  function putCourse(course: Course) {
    updateCatalogue((cat) => ({ ...cat, courses: [...cat.courses.filter((c) => c.id !== course.id), course].sort(byName) }));
  }

  function putBranch(branch: Branch) {
    updateCatalogue((cat) => ({ ...cat, branches: [...cat.branches.filter((b) => b.id !== branch.id), branch].sort(byName) }));
  }

  function add(id: string) {
    setPicked((m) => new Map(m).set(id, new Set()));
    setQuery('');
  }

  function remove(id: string) {
    setPicked((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  }

  function toggleBranch(courseId: string, specId: string | null) {
    setPicked((m) => {
      const next = new Map(m);
      const set = new Set(next.get(courseId) ?? []);
      if (specId === null) set.clear();
      else if (set.has(specId)) set.delete(specId);
      else set.add(specId);
      next.set(courseId, set);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (picked.size === 0) {
      setError('Add at least one course they run.');
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

  return (
    <form onSubmit={submit} noValidate>
      <section className="blk" ref={branchesRef}>
        <h2 className="blk-title">
          <span className="step-num">1</span> Branches
        </h2>
        <p className="blk-sub">
          One list for every course and every institution, so each branch has exactly one spelling. Add any that are
          missing here - courses then pick from this list.
        </p>
        <BranchManager branches={catalogue.branches} courses={courses} onAdded={putBranch} />
      </section>

      <section className="blk">
        <div className="blk-head">
          <div>
            <h2 className="blk-title">
              <span className="step-num">2</span> Courses they run
            </h2>
            <p className="blk-sub">Pick the courses, then narrow each to the branches this institution offers.</p>
          </div>
          <span className="blk-actions">
            {available.length > 0 && (
              <button
                type="button"
                className={`btn btn-sm ${browse ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setBrowse((v) => !v)}
                aria-expanded={browse}
              >
                {browse ? 'Hide the catalogue' : `Browse all ${available.length}`}
              </button>
            )}
            {!bulkCourses && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBulkCourses(true)}>
                Bulk upload (Excel)
              </button>
            )}
            {!addingCourse && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddingCourse(true)}>
                + Add a course
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
            onFindBranch={() => branchesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onCancel={() => setAddingCourse(false)}
            onAdded={(course) => {
              putCourse(course);
              add(course.id);
              setAddingCourse(false);
            }}
          />
        )}

        <div className="picker">
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses or branches - try “B.Tech” or “Computer”"
              aria-label="Search courses"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches[0]) {
                  e.preventDefault();
                  add(matches[0].id);
                }
              }}
            />
          </div>
          {(query || browse || picked.size === 0) && (
            <div className={`picker-results ${browse ? 'is-browsing' : ''}`}>
              {matches.map((c) => (
                <button key={c.id} type="button" className="picker-row" onClick={() => add(c.id)}>
                  <span>{c.name}</span>
                  <small>{c.specialisations.length ? `${c.specialisations.length} branches` : 'No branches'}</small>
                  <span className="picker-add">Add</span>
                </button>
              ))}
              {query.trim().length >= 2 && !exact && (
                <button type="button" className="picker-row picker-new" onClick={() => setAddingCourse(true)}>
                  <span>
                    + Add “<strong>{query.trim()}</strong>” as a new course
                  </span>
                </button>
              )}
              {matches.length === 0 && query.trim().length < 2 && (
                <p className="muted">No courses yet. Use “Add a course”.</p>
              )}
            </div>
          )}
        </div>

        {picked.size > 0 && (
          <div className="list-panel-head list-panel-head-inline">
            <h3>
              Courses this institution runs
              <span className="count">{picked.size}</span>
            </h3>
            {branchCount > 0 && (
              <p className="muted">
                {branchCount} branch{branchCount === 1 ? '' : 'es'} chosen across them
              </p>
            )}
          </div>
        )}

        {picked.size > 0 && (
          <ul className="courses">
            {[...picked].map(([courseId, chosen]) => {
              const course = byId.get(courseId);
              if (!course) return null;
              return (
                <li key={courseId} className="course">
                  <div className="course-head">
                    <strong>{course.name}</strong>
                    <span className="muted">
                      {chosen.size === 0 ? 'All branches' : `${chosen.size} of ${course.specialisations.length} branches`}
                    </span>
                    <button type="button" className="icon-btn" onClick={() => remove(courseId)} aria-label={`Remove ${course.name}`}>
                      ×
                    </button>
                  </div>
                  <div className="chips">
                    {course.specialisations.length > 0 && (
                      <Chip on={chosen.size === 0} onClick={() => toggleBranch(courseId, null)}>
                        All branches
                      </Chip>
                    )}
                    {course.specialisations.map((s) => (
                      <Chip key={s.id} on={chosen.has(s.id)} onClick={() => toggleBranch(courseId, s.id)}>
                        {s.name}
                      </Chip>
                    ))}
                    <AttachBranches
                      course={course}
                      branches={catalogue.branches}
                      onAttached={(updated) => {
                        putCourse(updated);
                        // A branch attached here is one this institution offers.
                        const before = new Set(course.specialisations.map((s) => s.id));
                        const fresh = updated.specialisations.filter((s) => !before.has(s.id)).map((s) => s.id);
                        if (chosen.size > 0) {
                          setPicked((m) => new Map(m).set(courseId, new Set([...chosen, ...fresh])));
                        }
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="blk">
        <h2 className="blk-title">Placement rules</h2>
        <div className="toggles">
          <Toggle
            checked={oneOffer}
            onChange={setOneOffer}
            label="One offer, then you’re out"
            description="New drives start with this on: a student who accepts an offer is withdrawn from the rest. Each drive can still change it."
          />
          <Toggle
            checked={selfJoin}
            onChange={setSelfJoin}
            label="Students can join with a batch code"
            description="Placement cells may share a code so students register themselves. Off means every student is entered by the college."
          />
          <Toggle
            checked={unverifiedAccess}
            onChange={setUnverifiedAccess}
            label="Companies can sign in while we check them"
            description="Off (usual): a company that registers waits for Apli.ai to verify it before it can sign in at all. On: it gets in at once and can draft, but still reaches no college of yours until it is verified."
          />
          <Toggle
            checked={companyApproval}
            onChange={setCompanyApproval}
            label="Companies need our approval first"
            description="On top of the platform's verification, the institution approves each company before it can send roles to any of its colleges. Off means each college's approval of each role is the gate."
          />
          <div className="response-days">
            <span className="toggle-text">
              <span className="toggle-label">Company response time</span>
              <span className="toggle-desc">
                Days a company has to answer an application before students and the placement cell see it as overdue.
              </span>
            </span>
            <select
              className="input"
              value={responseDays}
              onChange={(e) => setResponseDays(Number(e.target.value))}
              aria-label="Company response time in days"
            >
              {[3, 5, 7, 10, 14, 21, 30].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

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
