import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type BatchForm, type CollegeRow, type OnboardingState } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { Chip, Field, Segmented, SidePanel, StepFooter } from '../ui';

/** A passing year as universities write it: the academic year it ends. 2027 -> "2026-2027". */
export const academicYear = (passingYear: number) => `${passingYear - 1}-${passingYear}`;

const SCOPES: { value: BatchForm['scope']; label: string; hint: string }[] = [
  { value: 'UNIVERSITY', label: 'Whole university', hint: 'One batch across every college - e.g. “2026 Batch”' },
  { value: 'ALL_COLLEGES', label: 'In every college', hint: 'The same batch created inside each college' },
  { value: 'SOME_COLLEGES', label: 'Chosen colleges', hint: 'Only in the colleges you pick' },
];

/** The college filter's value for batches that belong to the whole university. */
const UNIVERSITY = '__university';

/**
 * The batches: how this institution groups its students.
 *
 * Batches multiply - colleges × their course/branch pairs × passing years -
 * so the step is the list of them, as a table you can filter by college and
 * year. Making them happens in a side panel: "from the mapping" for nearly
 * everybody, "by hand" for any other kind of group.
 */
export default function BatchesStep({ state, catalogue, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const colleges = state!.colleges;
  const batches = state!.batches;

  const thisYear = new Date().getFullYear();
  // From the batch passing out this academic year to five years on - a
  // first-year cohort of a five-year course.
  const years = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3, thisYear + 4, thisYear + 5];

  const [panel, setPanel] = useState<'mapping' | 'hand' | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The table's filters and selection.
  const [query, setQuery] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return batches
      .filter((b) =>
        !collegeFilter ? true : collegeFilter === UNIVERSITY ? !b.collegeId : b.collegeId === collegeFilter,
      )
      .filter((b) => !yearFilter || String(b.graduationYear ?? '') === yearFilter)
      .filter(
        (b) =>
          !q ||
          b.name.toLowerCase().includes(q) ||
          (b.course ?? '').toLowerCase().includes(q) ||
          (b.specialisation ?? '').toLowerCase().includes(q) ||
          (b.college?.code ?? '').toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          (a.college?.code ?? '').localeCompare(b.college?.code ?? '') ||
          (a.graduationYear ?? 0) - (b.graduationYear ?? 0) ||
          a.name.localeCompare(b.name),
      );
  }, [batches, query, collegeFilter, yearFilter]);

  const usedYears = useMemo(
    () => [...new Set(batches.map((b) => b.graduationYear).filter((y): y is number => !!y))].sort(),
    [batches],
  );

  // Only empty batches can be removed; one with students in it is kept.
  const removable = shown.filter((b) => b.students === 0);
  const picked = [...selected].filter((id) => batches.some((b) => b.id === id && b.students === 0));
  const allPicked = removable.length > 0 && removable.every((b) => selected.has(b.id));

  function flip(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setConfirming(false);
  }

  async function removeSelected() {
    setRemoving(true);
    setError(null);
    // One at a time: each delete returns the fresh state. If one fails, the
    // ones already removed still show as removed.
    let last: OnboardingState | null = null;
    let done = 0;
    try {
      for (const id of picked) {
        last = await platformApi.deleteBatch(t.id, id);
        done++;
      }
      setNotice(`Removed ${done} batch${done === 1 ? '' : 'es'}.`);
      setSelected(new Set());
    } catch (err) {
      setError(
        (err instanceof ApiError ? err.message : 'Could not remove those batches.') +
          (done ? ` ${done} were removed before that.` : ''),
      );
    } finally {
      if (last) onSaved(last);
      setRemoving(false);
      setConfirming(false);
    }
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    if (batches.length === 0 && !t.completedSteps.includes('batches')) {
      onSaved(await platformApi.completeStep(t.id, 'batches'));
    }
    goto('features');
  }

  const mappedColleges = colleges.filter((c) => c.programs > 0);

  return (
    <form onSubmit={next} noValidate>
      <section className="blk cg-blk">
        {batches.length > 0 && (
          <div className="cg-bar">
            <div className="search cg-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m20 20-4.2-4.2" />
              </svg>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a batch, course or branch"
                aria-label="Find a batch"
              />
            </div>
            <select
              className="input cg-select"
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              aria-label="Filter by college"
            >
              <option value="">All colleges</option>
              <option value={UNIVERSITY}>Whole university</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
            <select
              className="input cg-select"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Filter by passing year"
            >
              <option value="">All years</option>
              {usedYears.map((y) => (
                <option key={y} value={y}>
                  {academicYear(y)}
                </option>
              ))}
            </select>
            <span className="cg-tools">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPanel('hand')}>
                Make one by hand
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPanel('mapping')}>
                + Create from mapping
              </button>
            </span>
          </div>
        )}

        {notice && (
          <p className="notice ob-in cg-notice" role="status">
            {notice}
          </p>
        )}

        {batches.length === 0 ? (
          <div className="cg-start">
            <h3>No batches yet</h3>
            <p>
              A batch is one college’s course, branch and passing year - e.g. “PICT · B.E. Computer Engineering{' '}
              {academicYear(thisYear + 1)}”. Drives, eligibility and reports work at that level, and students join
              their batch automatically. This step is optional.
            </p>
            {mappedColleges.length === 0 ? (
              <button type="button" className="btn btn-secondary" onClick={() => goto('mapping')}>
                ← Map courses to colleges first
              </button>
            ) : (
              <span className="cg-start-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setPanel('mapping')}>
                  + Create from mapping
                </button>
                <button type="button" className="linkish" onClick={() => setPanel('hand')}>
                  or make one by hand
                </button>
              </span>
            )}
          </div>
        ) : (
          <>
            {picked.length > 0 && (
              <div className="ct-bulk ob-in">
                <span>
                  {picked.length} batch{picked.length === 1 ? '' : 'es'} selected
                </span>
                {confirming ? (
                  <>
                    <span className="ct-bulk-q">Remove them? This cannot be undone.</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={removeSelected} disabled={removing}>
                      {removing ? 'Removing…' : `Remove ${picked.length}`}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
                      Clear
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(true)}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            )}

            {shown.length === 0 ? (
              <div className="cg-empty">
                <p>No batch matches those filters.</p>
              </div>
            ) : (
              <div className="ct-wrap">
                <table className="ct">
                  <thead>
                    <tr>
                      <th className="ct-tick">
                        <input
                          type="checkbox"
                          aria-label="Select every empty batch shown"
                          title="Only batches with no students can be removed"
                          checked={allPicked}
                          disabled={removable.length === 0}
                          onChange={() => {
                            setSelected(allPicked ? new Set() : new Set(removable.map((b) => b.id)));
                            setConfirming(false);
                          }}
                        />
                      </th>
                      <th>Batch</th>
                      <th>College</th>
                      <th>Course</th>
                      <th>Branch</th>
                      <th>Passing year</th>
                      <th className="ct-num">Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((b) => {
                      const locked = b.students > 0;
                      return (
                        <tr
                          key={b.id}
                          className={selected.has(b.id) ? 'is-on' : ''}
                          onClick={() => !locked && flip(b.id)}
                          title={locked ? 'Has students, so it cannot be removed here' : undefined}
                        >
                          <td className="ct-tick">
                            <input
                              type="checkbox"
                              checked={selected.has(b.id)}
                              disabled={locked}
                              aria-label={`Select ${b.name}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => flip(b.id)}
                            />
                          </td>
                          <td className="ct-name ct-wrap-text">{b.name}</td>
                          <td className={b.college ? 'ct-code' : 'ct-muted'}>{b.college?.code ?? 'University'}</td>
                          <td>{b.course ?? <span className="ct-muted">Any</span>}</td>
                          <td>{b.specialisation ?? <span className="ct-muted">All</span>}</td>
                          <td className="ct-muted">
                            {b.graduationYear ? academicYear(b.graduationYear) : b.studyYear ? `Year ${b.studyYear}` : '—'}
                          </td>
                          <td className="ct-num">{b.students || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {panel === 'mapping' && (
        <FromMappingPanel
          tenantId={t.id}
          colleges={mappedColleges}
          years={years}
          thisYear={thisYear}
          onClose={closePanel}
          onCreated={(res, message) => {
            onSaved(res);
            setNotice(message);
            setPanel(null);
          }}
        />
      )}

      {panel === 'hand' && (
        <ByHandPanel
          state={state!}
          catalogue={catalogue}
          years={years}
          thisYear={thisYear}
          onClose={closePanel}
          onCreated={(res, message) => {
            onSaved(res);
            setNotice(message);
            setPanel(null);
          }}
        />
      )}

      <StepFooter
        busy={false}
        error={error}
        onBack={() => goto('mapping')}
        submitLabel={batches.length ? 'Continue' : 'Skip for now'}
        note={`${batches.length} batch${batches.length === 1 ? '' : 'es'}`}
      />
    </form>
  );
}


/* -------------------------------------------------------------------------- */
/* Create from the mapping                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The usual way: one batch for every course/branch pair each mapped college
 * runs, for each passing year picked. Colleges are a table with ticks, since
 * a university can have dozens.
 */
function FromMappingPanel({
  tenantId,
  colleges,
  years,
  thisYear,
  onClose,
  onCreated,
}: {
  tenantId: string;
  colleges: CollegeRow[];
  years: number[];
  thisYear: number;
  onClose: () => void;
  onCreated: (res: OnboardingState, message: string) => void;
}) {
  const [pickYears, setPickYears] = useState<number[]>([thisYear + 1]);
  // Every mapped college starts ticked: untick the ones to leave out.
  const [pickColleges, setPickColleges] = useState<Set<string>>(() => new Set(colleges.map((c) => c.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = colleges.filter((c) => pickColleges.has(c.id));
  const count = targets.reduce((n, c) => n + c.programs, 0) * pickYears.length;
  const allOn = targets.length === colleges.length;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.createBatchesFromMapping(tenantId, {
        graduationYears: pickYears,
        collegeIds: allOn ? undefined : [...pickColleges],
      });
      const { created, skipped } = res.result;
      onCreated(
        res,
        `Created ${created.length} batch${created.length === 1 ? '' : 'es'}.` +
          (skipped.length ? ` ${skipped.length} already existed and were left as they are.` : ''),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the batches.');
      setBusy(false);
    }
  }

  return (
    <SidePanel
      title="Create batches from the mapping"
      subtitle="One batch for each college, course, branch and passing year"
      onClose={onClose}
      footer={
        <>
          <span className="sp-foot-note">
            Up to <strong>{count}</strong> batch{count === 1 ? '' : 'es'} · ones that already exist are skipped
          </span>
          {error && <span className="f-error">{error}</span>}
          <button type="button" className="btn btn-primary" onClick={create} disabled={busy || count === 0}>
            {busy ? 'Creating…' : `Create ${count} batch${count === 1 ? '' : 'es'}`}
          </button>
        </>
      }
    >
      <div className="sp-section">
        <h3>Passing years</h3>
        <p className="sp-hint">The academic year each batch passes out in. Pick one or more.</p>
        <div className="chips">
          {years.map((y) => (
            <Chip
              key={y}
              on={pickYears.includes(y)}
              onClick={() => setPickYears((v) => (v.includes(y) ? v.filter((x) => x !== y) : [...v, y].sort()))}
            >
              {academicYear(y)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="sp-section">
        <h3>
          Colleges <span className="count">{targets.length}</span>
        </h3>
        <p className="sp-hint">Every college with courses mapped. Untick any to leave out.</p>
        <div className="ct-wrap is-short">
          <table className="ct">
            <thead>
              <tr>
                <th className="ct-tick">
                  <input
                    type="checkbox"
                    aria-label={allOn ? 'Untick every college' : 'Tick every college'}
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = targets.length > 0 && !allOn;
                    }}
                    onChange={() => setPickColleges(allOn ? new Set() : new Set(colleges.map((c) => c.id)))}
                  />
                </th>
                <th>Code</th>
                <th>College</th>
                <th className="ct-num">Course/branch pairs</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => {
                const on = pickColleges.has(c.id);
                const flip = () =>
                  setPickColleges((s) => {
                    const n = new Set(s);
                    if (n.has(c.id)) n.delete(c.id);
                    else n.add(c.id);
                    return n;
                  });
                return (
                  <tr key={c.id} className={on ? 'is-on' : ''} onClick={flip}>
                    <td className="ct-tick">
                      <input
                        type="checkbox"
                        checked={on}
                        aria-label={c.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={flip}
                      />
                    </td>
                    <td className="ct-code">{c.code}</td>
                    <td className="ct-wrap-text">{c.name}</td>
                    <td className="ct-num">{c.programs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SidePanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Make one by hand                                                            */
/* -------------------------------------------------------------------------- */

/** Any other kind of group: a whole-university year, the same batch in every college, a year of study. */
function ByHandPanel({
  state,
  catalogue,
  years,
  thisYear,
  onClose,
  onCreated,
}: {
  state: NonNullable<StepProps['state']>;
  catalogue: StepProps['catalogue'];
  years: number[];
  thisYear: number;
  onClose: () => void;
  onCreated: (res: OnboardingState, message: string) => void;
}) {
  const colleges = state.colleges;
  const [form, setForm] = useState<BatchForm>({
    scope: 'UNIVERSITY',
    collegeIds: [],
    name: '',
    course: '',
    specialisation: '',
    graduationYear: thisYear + 1,
    studyYear: undefined,
    headOfDept: '',
  });
  const [nameTouched, setNameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The courses this institution runs, each with the branches it offers.
  const courses = useMemo(
    () =>
      state.programs.map((p) => {
        const course = catalogue.courses.find((c) => c.id === p.courseId);
        const all = course?.specialisations ?? [];
        const offered = p.specialisationIds.length ? all.filter((s) => p.specialisationIds.includes(s.id)) : all;
        return { name: p.courseName, branches: offered.map((s) => s.name) };
      }),
    [state, catalogue],
  );
  const branches = courses.find((c) => c.name === form.course)?.branches ?? [];

  const suggested = useMemo(() => {
    const parts = [form.course, form.specialisation, form.graduationYear ? academicYear(form.graduationYear) : ''].filter(Boolean);
    if (parts.length === 0) return form.studyYear ? `Year ${form.studyYear}` : '';
    // A year on its own reads as "2026-2027 Batch", the way universities say it.
    if (!form.course && !form.specialisation) return `${academicYear(form.graduationYear!)} Batch`;
    return parts.join(' ');
  }, [form.course, form.specialisation, form.graduationYear, form.studyYear]);
  const name = nameTouched ? form.name : suggested;

  const targets =
    form.scope === 'UNIVERSITY'
      ? [null]
      : form.scope === 'ALL_COLLEGES'
        ? colleges
        : colleges.filter((c) => form.collegeIds.includes(c.id));

  function set<K extends keyof BatchForm>(key: K, value: BatchForm[K]) {
    setForm((f) => ({ ...f, [key]: value, ...(key === 'course' ? { specialisation: '' } : {}) }));
    setError(null);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.createBatches(state.tenant.id, { ...form, name });
      const { created, skipped } = res.result;
      onCreated(
        res,
        [
          created.length ? `Created ${created.length} batch${created.length === 1 ? '' : 'es'}.` : '',
          skipped.length
            ? `${skipped.length} skipped - ${skipped.map((s) => s.college ?? 'the university').join(', ')} already ${skipped.length === 1 ? 'has' : 'have'} “${skipped[0]!.name}”.`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that batch.');
      setBusy(false);
    }
  }

  return (
    <SidePanel
      title="Make a batch by hand"
      subtitle="For any other group - a whole-university year, or the same batch in every college"
      onClose={onClose}
      footer={
        <>
          <span className="sp-foot-note">
            {name ? (
              <>
                Creates <strong>{targets.length}</strong> batch{targets.length === 1 ? '' : 'es'}
                {targets.length === 1 && targets[0] === null ? ' for the whole university' : ''}
              </>
            ) : (
              'Choose a year, a course, or type a name.'
            )}
          </span>
          {error && <span className="f-error">{error}</span>}
          <button type="button" className="btn btn-primary" onClick={create} disabled={busy || !name || targets.length === 0}>
            {busy ? 'Creating…' : `Create ${targets.length > 1 ? `${targets.length} batches` : 'batch'}`}
          </button>
        </>
      }
    >
      <div className="sp-section">
        <h3>Who is it for</h3>
        <Segmented label="Who is the batch for" value={form.scope} onChange={(v) => set('scope', v)} options={SCOPES} />
        <p className="sp-hint">{SCOPES.find((s) => s.value === form.scope)?.hint}</p>
        {form.scope === 'SOME_COLLEGES' && (
          <div className="chips">
            {colleges.map((c) => (
              <Chip
                key={c.id}
                on={form.collegeIds.includes(c.id)}
                onClick={() =>
                  set(
                    'collegeIds',
                    form.collegeIds.includes(c.id) ? form.collegeIds.filter((x) => x !== c.id) : [...form.collegeIds, c.id],
                  )
                }
                title={c.name}
              >
                {c.code}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="sp-section">
        <h3>What it is</h3>
        <div className="grid batch-grid">
          <Field label="Course" optional>
            {(id) => (
              <select id={id} className="input" value={form.course} onChange={(e) => set('course', e.target.value)}>
                <option value="">Any course</option>
                {courses.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Branch" optional>
            {(id) => (
              <select
                id={id}
                className="input"
                value={form.specialisation}
                onChange={(e) => set('specialisation', e.target.value)}
                disabled={!form.course || branches.length === 0}
              >
                <option value="">{form.course ? 'All branches' : 'Pick a course first'}</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Passing year" optional>
            {(id) => (
              <select
                id={id}
                className="input"
                value={form.graduationYear ?? ''}
                onChange={(e) => set('graduationYear', e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">—</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {academicYear(y)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Year of study" hint="For a group like “Second year”." optional>
            {(id) => (
              <select
                id={id}
                className="input"
                value={form.studyYear ?? ''}
                onChange={(e) => set('studyYear', e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Head of department" optional>
            {(id) => (
              <input
                id={id}
                className="input"
                value={form.headOfDept}
                onChange={(e) => set('headOfDept', e.target.value)}
                placeholder="Demo HOD"
              />
            )}
          </Field>
          <Field
            label="Batch name"
            hint={nameTouched && suggested ? undefined : 'Written from the course, branch and year. Change it if you like.'}
            wide
          >
            {(id) => (
              <div className="affix">
                <input
                  id={id}
                  className="input affix-input"
                  value={name}
                  onChange={(e) => {
                    setNameTouched(true);
                    set('name', e.target.value);
                  }}
                  placeholder={`${academicYear(thisYear + 1)} Batch`}
                  maxLength={120}
                />
                {nameTouched && suggested && (
                  <button type="button" className="btn btn-secondary btn-sm affix-btn" onClick={() => setNameTouched(false)}>
                    Use “{suggested}”
                  </button>
                )}
              </div>
            )}
          </Field>
        </div>
      </div>
    </SidePanel>
  );
}
