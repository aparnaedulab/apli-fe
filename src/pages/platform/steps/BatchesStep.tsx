import { useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type BatchForm, type BatchRow } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { Chip, Field, Segmented, StepFooter } from '../ui';

/** A passing year as universities write it: the academic year it ends. 2027 -> "2026-2027". */
export const academicYear = (passingYear: number) => `${passingYear - 1}-${passingYear}`;

const SCOPES: { value: BatchForm['scope']; label: string; hint: string }[] = [
  { value: 'UNIVERSITY', label: 'Whole university', hint: 'One batch across every college - e.g. “2026 Batch”' },
  { value: 'ALL_COLLEGES', label: 'In every college', hint: 'The same batch created inside each college' },
  { value: 'SOME_COLLEGES', label: 'Chosen colleges', hint: 'Only in the colleges you pick' },
];

/**
 * The batches: how this institution groups its students.
 *
 * Its own step, after colleges and courses, because a batch names both. There
 * is no one right shape - one university has a single "2026 Batch", another a
 * "B.Tech Computer Engineering 2026" in each college - so the admin builds
 * them: who the batch is for, then any of course, branch and year. The name
 * writes itself from those and can be changed.
 */
export default function BatchesStep({ state, catalogue, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const colleges = state!.colleges;
  const batches = state!.batches;

  const thisYear = new Date().getFullYear();
  // From the batch passing out this academic year to five years on - a
  // first-year cohort of a five-year course.
  const years = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3, thisYear + 4, thisYear + 5];

  // Colleges with courses mapped: what "create from the mapping" works from.
  const mappedColleges = colleges.filter((c) => c.programs > 0);
  const [fromYears, setFromYears] = useState<number[]>([thisYear + 1]);
  const [fromColleges, setFromColleges] = useState<string[]>([]);
  const fromTargets = fromColleges.length
    ? mappedColleges.filter((c) => fromColleges.includes(c.id))
    : mappedColleges;
  const fromCount = fromTargets.reduce((n, c) => n + c.programs, 0) * fromYears.length;

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
  /** The by-hand route, folded until somebody wants it. */
  const [byHand, setByHand] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The courses this institution runs, each with the branches it offers.
  const courses = useMemo(
    () =>
      state!.programs.map((p) => {
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

  function preset(p: Partial<BatchForm>) {
    setForm((f) => ({ ...f, course: '', specialisation: '', studyYear: undefined, collegeIds: [], ...p }));
    setNameTouched(false);
  }

  async function create() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await platformApi.createBatches(t.id, { ...form, name });
      onSaved(res);
      const { created, skipped } = res.result;
      setNotice(
        [
          created.length ? `Created ${created.length} batch${created.length === 1 ? '' : 'es'}.` : '',
          skipped.length
            ? `${skipped.length} skipped - ${skipped.map((s) => s.college ?? 'the university').join(', ')} already ${skipped.length === 1 ? 'has' : 'have'} “${skipped[0]!.name}”.`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
      setNameTouched(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that batch.');
    } finally {
      setBusy(false);
    }
  }

  async function createFromMapping() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await platformApi.createBatchesFromMapping(t.id, {
        graduationYears: fromYears,
        collegeIds: fromColleges.length ? fromColleges : undefined,
      });
      onSaved(res);
      const { created, skipped } = res.result;
      setNotice(
        `Created ${created.length} batch${created.length === 1 ? '' : 'es'}.` +
          (skipped.length ? ` ${skipped.length} already existed and were left as they are.` : ''),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the batches.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: BatchRow) {
    try {
      onSaved(await platformApi.deleteBatch(t.id, b.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that batch.');
    }
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    if (batches.length === 0 && !t.completedSteps.includes('batches')) {
      onSaved(await platformApi.completeStep(t.id, 'batches'));
    }
    goto('features');
  }

  // Grouped for the list: the university's own first, then college by college.
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: BatchRow[] }>();
    for (const b of batches) {
      const key = b.collegeId ?? '';
      const title = b.college ? `${b.college.code} · ${b.college.name}` : 'Whole university';
      if (!map.has(key)) map.set(key, { title, items: [] });
      map.get(key)!.items.push(b);
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([, g]) => g);
  }, [batches]);

  return (
    <form onSubmit={next} noValidate>
      {/*
        One way in at a time.

        Two creation blocks used to sit open on top of each other - "from
        your mapping" and "by hand" - each with its own fields, and the
        reader had to work out which one they were in before they could do
        anything. The mapped route is right for nearly everybody, so it is
        the one that is open; the other is a line underneath.
      */}
      <section className="blk">
        <h2 className="blk-title">Create the batches</h2>
        <p className="blk-sub">
          One batch for each college, course, branch and passing year - e.g. “PICT · B.E. Computer Engineering{' '}
          {academicYear(thisYear + 1)}”. That is the level drives, eligibility and reports work at, and students
          mapped to that course and branch later join their batch automatically, by their passing year.
        </p>

        {mappedColleges.length === 0 ? (
          <p className="notice">
            No college has courses mapped yet.{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => goto('mapping')}>
              ← Map courses to colleges
            </button>
          </p>
        ) : (
          <>
            <Field label="Passing years" hint="The academic year the batch passes out in. Pick one or more." wide>
              {() => (
                <div className="chips">
                  {years.map((y) => (
                    <Chip
                      key={y}
                      on={fromYears.includes(y)}
                      onClick={() =>
                        setFromYears((v) => (v.includes(y) ? v.filter((x) => x !== y) : [...v, y].sort()))
                      }
                    >
                      {academicYear(y)}
                    </Chip>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Colleges" hint="All mapped colleges, unless you pick some." optional wide>
              {() => (
                <div className="chips">
                  {mappedColleges.map((c) => (
                    <Chip
                      key={c.id}
                      on={fromColleges.includes(c.id)}
                      title={`${c.name} · ${c.programs} course/branch${c.programs === 1 ? '' : 'es'}`}
                      onClick={() =>
                        setFromColleges((v) => (v.includes(c.id) ? v.filter((x) => x !== c.id) : [...v, c.id]))
                      }
                    >
                      {c.code}
                    </Chip>
                  ))}
                </div>
              )}
            </Field>
            <div className="batch-preview">
              <span>
                Creates up to <strong>{fromCount}</strong> batch{fromCount === 1 ? '' : 'es'}:{' '}
                {fromTargets.length} college{fromTargets.length === 1 ? '' : 's'} × their course/branch pairs ×{' '}
                {fromYears.length} passing year{fromYears.length === 1 ? '' : 's'}. Ones that already exist are skipped.
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={createFromMapping}
                disabled={busy || fromCount === 0}
              >
                {busy ? 'Creating…' : `Create ${fromCount} batches`}
              </button>
            </div>
          </>
        )}
      </section>

      <section className={`blk ${byHand ? '' : 'blk-quiet'}`}>
        <button
          type="button"
          className="blk-fold"
          onClick={() => setByHand((v) => !v)}
          aria-expanded={byHand}
        >
          Or make one by hand
          <small>
            For any other group — a whole-university year, or the same batch in every college
          </small>
        </button>

        {byHand && (
          <>

        <div className="presets">
          <span className="muted">Quick start:</span>
          <button type="button" className="chip" onClick={() => preset({ scope: 'UNIVERSITY', graduationYear: thisYear + 1 })}>
            {academicYear(thisYear + 1)} Batch · whole university
          </button>
          {courses[0] && (
            <button
              type="button"
              className="chip"
              onClick={() => preset({ scope: 'ALL_COLLEGES', course: courses[0]!.name, graduationYear: thisYear + 1 })}
            >
              {courses[0].name} {academicYear(thisYear + 1)} · in every college
            </button>
          )}
        </div>

        <Field label="Who is it for">
          {() => (
            <div className="affiliation">
              <Segmented label="Who is the batch for" value={form.scope} onChange={(v) => set('scope', v)} options={SCOPES} />
              <p className="f-hint">{SCOPES.find((s) => s.value === form.scope)?.hint}</p>
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
          )}
        </Field>

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
          <Field label="Passing year" hint="The academic year the batch passes out in." optional>
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
          <Field label="Year of study" hint="For a group like “Second year”, which keeps its name as students move up." optional>
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
            hint={nameTouched && suggested ? undefined : 'Written from the course, branch and year. Change it if you call it something else.'}
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

        <div className="batch-preview">
          <span>
            {name ? (
              <>
                Creates <strong>{targets.length}</strong> batch{targets.length === 1 ? '' : 'es'}:{' '}
                {targets
                  .slice(0, 4)
                  .map((c) => (c ? `${c.code} · ${name}` : `${name} (whole university)`))
                  .join(', ')}
                {targets.length > 4 && ` and ${targets.length - 4} more`}
              </>
            ) : (
              <span className="muted">Choose a year, a course, or type a name.</span>
            )}
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={create} disabled={busy || !name || targets.length === 0}>
            {busy ? 'Creating…' : `Create ${targets.length > 1 ? `${targets.length} batches` : 'batch'}`}
          </button>
        </div>

            {notice && (
              <p className="notice ob-in" role="status">
                {notice}
              </p>
            )}
          </>
        )}
      </section>

      <section className="blk">
        <h2 className="blk-title">Batches so far</h2>
        {batches.length === 0 ? (
          <p className="muted">None yet. You can continue without any.</p>
        ) : (
          <div className="batch-groups">
            {groups.map((g) => (
              <div key={g.title} className="batch-group">
                <p className="batch-group-title">{g.title}</p>
                <div className="chips">
                  {g.items.map((b) => (
                    <span key={b.id} className="chip is-static batch-chip" title={batchTitle(b)}>
                      {b.name}
                      {b.students > 0 ? (
                        <small> · {b.students}</small>
                      ) : (
                        <button type="button" className="batch-x" onClick={() => remove(b)} aria-label={`Remove ${b.name}`}>
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

function batchTitle(b: BatchRow): string {
  return [
    b.course,
    b.specialisation,
    b.graduationYear ? `passing ${academicYear(b.graduationYear)}` : null,
    b.studyYear ? `Year ${b.studyYear}` : null,
    `${b.students} students`,
  ]
    .filter(Boolean)
    .join(' · ');
}
