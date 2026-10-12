import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  platformApi,
  type BulkCollegesResult,
  type Catalogue,
  type CollegeForm,
  type OnboardingState,
} from '../../api/platform';
import { platformMapping, type ProgramChoice } from '../../api/mapping';
import ConsoleHeader from '../platform/ConsoleHeader';
import { initials, SETUP_STEPS, stepsDone, type SetupKey } from './steps';
import InstitutionFlow from './InstitutionFlow';
import '../platform/Platform.css';
import './super.css';

/**
 * Setting up one institution, in the order the super admin works:
 *
 *   1. its details     - who it is and who to talk to
 *   2. its colleges    - one, or hundreds from a spreadsheet
 *   3. its courses     - what it runs, and which college runs which
 *   4. features        - next; not built yet
 *
 * Each step saves on its own, so a half-finished institution is a draft that
 * can be picked up from the home screen another day.
 */

type Errors = Record<string, string>;

const fail = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function fieldErrors(e: unknown): Errors {
  if (!(e instanceof ApiError) || !e.fields?.length) return {};
  return Object.fromEntries(e.fields.map((f) => [f.path.split('.').pop() ?? f.path, f.message]));
}

export default function SuperSetup() {
  const { id, step } = useParams<{ id?: string; step?: string }>();
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const at: SetupKey = !id ? 'institution' : (SETUP_STEPS.find((s) => s.key === step)?.key ?? 'institution');

  useEffect(() => {
    platformApi
      .catalogue()
      .then(setCatalogue)
      .catch((e) => setError(fail(e, 'Could not load the lists.')));
  }, []);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      setState(await platformApi.state(id));
    } catch (e) {
      setError(fail(e, 'Could not load this institution.'));
    }
  }, [id]);

  useEffect(() => {
    setState(null);
    void reload();
  }, [reload]);

  // An institution opened without a step goes to the first one not done.
  useEffect(() => {
    if (!id || step || !state) return;
    const done = stepsDone({ completedSteps: state.tenant.completedSteps, colleges: state.colleges.length });
    const next = SETUP_STEPS.find((s) => s.ready && !done.has(s.key)) ?? SETUP_STEPS[0]!;
    navigate(`/platform/tenants/${id}/${next.key}`, { replace: true });
  }, [id, step, state, navigate]);

  const go = (key: SetupKey, tenantId = id) => navigate(`/platform/tenants/${tenantId}/${key}`);

  const done = state
    ? stepsDone({ completedSteps: state.tenant.completedSteps, colleges: state.colleges.length })
    : new Set<SetupKey>();
  const ready = catalogue && (!id || state);

  return (
    <div className="console">
      <ConsoleHeader />

      <div className={`sa-canvas ${at === 'institution' ? 'is-guided' : ''}`}>
        <div className="sa-top">
          <Link to="/platform" className="sa-back">
            ← Institutions
          </Link>
          <div className="sa-who">
            <span className="sa-mark" style={{ background: state?.tenant.brandColor ?? 'var(--brand)' }} aria-hidden="true">
              {state?.tenant.logoUrl ? (
                <img src={state.tenant.logoUrl} alt="" />
              ) : (
                (state?.tenant.shortName || state?.tenant.name || '+').slice(0, 2).toUpperCase()
              )}
            </span>
            <b>{state ? state.tenant.shortName || state.tenant.name : 'New university'}</b>
            <small>{state ? (state.tenant.status === 'ACTIVE' ? 'Live' : 'Setting up') : 'Not saved yet'}</small>
          </div>
        </div>

        <ol className="sa-stages" aria-label="Setup steps">
          {SETUP_STEPS.map((s, i) => {
            const reachable = s.ready && (s.key === 'institution' || Boolean(id));
            const cls = [at === s.key ? 'is-now' : '', done.has(s.key) ? 'is-done' : '', s.ready ? '' : 'is-later']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={s.key} className={cls}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => (id ? go(s.key) : undefined)}
                  aria-current={at === s.key ? 'step' : undefined}
                  title={s.ready ? s.hint : 'Coming next'}
                >
                  <span className="sa-stage-dot">{done.has(s.key) ? '✓' : i + 1}</span>
                  <span>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <main className="sa-main">
        {error && <p className="notice notice-stop">{error}</p>}
        {!ready && !error && <p className="muted">Loading…</p>}

        {ready && at === 'institution' && (
          <InstitutionFlow
            catalogue={catalogue}
            tenant={state?.tenant ?? null}
            onSaved={(tenantId, fresh) => {
              if (fresh) setState(fresh);
              go('colleges', tenantId);
            }}
          />
        )}
        {ready && state && at === 'colleges' && (
          <CollegesStep
            catalogue={catalogue}
            state={state}
            onChange={setState}
            onNext={() => go('courses')}
          />
        )}
        {ready && state && at === 'courses' && (
          <CoursesStep catalogue={catalogue} state={state} onChange={setState} reloadCatalogue={setCatalogue} />
        )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                 */
/* -------------------------------------------------------------------------- */

function Card({ title, lede, children, aside }: { title: string; lede?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="sa-panel">
      <div className="sa-panel-head">
        <div>
          <h2>{title}</h2>
          {lede && <p className="muted">{lede}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  wide,
  hint,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={`sa-field ${wide ? 'is-wide' : ''} ${error ? 'has-error' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <em>{error}</em> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Colleges                                                                 */
/* -------------------------------------------------------------------------- */

const emptyCollege = (state: string): CollegeForm => ({
  name: '',
  code: '',
  collegeTypeId: '',
  affiliation: 'THIS_UNIVERSITY',
  affiliationName: '',
  city: '',
  state,
  address: '',
  pincode: '',
  naacGrade: '',
  isVerified: false,
  // Left empty on purpose: an officer here would be emailed an invitation.
  officerName: '',
  officerEmail: '',
});

function CollegesStep({
  catalogue,
  state,
  onChange,
  onNext,
}: {
  catalogue: Catalogue;
  state: OnboardingState;
  onChange: (s: OnboardingState) => void;
  onNext: () => void;
}) {
  const t = state.tenant;
  const [mode, setMode] = useState<'one' | 'sheet'>('one');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const single = t.kind === 'COLLEGE';
  const shown = state.colleges.filter((c) =>
    [c.name, c.code, c.city].some((v) => v.toLowerCase().includes(q.trim().toLowerCase())),
  );

  async function remove(collegeId: string) {
    setBusy(collegeId);
    setError(null);
    try {
      onChange(await platformApi.deleteCollege(t.id, collegeId));
    } catch (e) {
      setError(fail(e, 'Could not remove that college.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sa-stack">
      <Card
        title={single ? 'The college' : 'Add colleges'}
        lede={
          single
            ? 'An autonomous college is its own only college. Add it here.'
            : 'Every college under this university. Add one at a time, or upload them all from a spreadsheet.'
        }
        aside={
          single ? undefined : (
            <div className="seg seg-sm" role="radiogroup" aria-label="How to add">
              {(
                [
                  ['one', 'One at a time'],
                  ['sheet', 'From a spreadsheet'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={mode === k}
                  className={`seg-opt ${mode === k ? 'is-on' : ''}`}
                  onClick={() => setMode(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          )
        }
      >
        {mode === 'one' || single ? (
          <AddCollege catalogue={catalogue} state={state} onChange={onChange} />
        ) : (
          <CollegeSheet tenantId={t.id} onChange={onChange} />
        )}
      </Card>

      <Card
        title={`Colleges added · ${state.colleges.length}`}
        aside={
          state.colleges.length > 8 ? (
            <input
              className="input sa-search"
              type="search"
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search colleges"
            />
          ) : undefined
        }
      >
        {error && <p className="notice notice-stop">{error}</p>}
        {state.colleges.length === 0 ? (
          <p className="co-empty">None yet. Add the first one above.</p>
        ) : (
          <div className="od-table-wrap">
            <table className="od-table">
              <thead>
                <tr>
                  <th>College</th>
                  <th>Code</th>
                  <th>Where</th>
                  <th className="is-num">Courses</th>
                  <th className="is-num">Students</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td className="od-name">{c.name}</td>
                    <td>
                      <code>{c.code}</code>
                    </td>
                    <td>{[c.city, c.state].filter(Boolean).join(', ')}</td>
                    <td className="is-num">{c.programs}</td>
                    <td className="is-num">{c.students}</td>
                    <td className="od-act">
                      {c.students === 0 && c.batches === 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy === c.id}
                          onClick={() => remove(c.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="sa-actions">
        <button type="button" className="btn btn-primary" disabled={state.colleges.length === 0} onClick={onNext}>
          Next: courses →
        </button>
      </div>
    </div>
  );
}

function AddCollege({
  catalogue,
  state,
  onChange,
}: {
  catalogue: Catalogue;
  state: OnboardingState;
  onChange: (s: OnboardingState) => void;
}) {
  const t = state.tenant;
  const [form, setForm] = useState<CollegeForm>(() => emptyCollege(t.state ?? ''));
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CollegeForm>(k: K, v: CollegeForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!codeTouched) setForm((f) => ({ ...f, code: initials(f.name, 10).toUpperCase() }));
  }, [form.name, codeTouched]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setNote(null);
    try {
      const fresh = await platformApi.createCollege(t.id, form);
      onChange(fresh);
      setNote(`Added ${form.name}.`);
      // Ready for the next one, keeping what colleges of one university share.
      setForm((f) => ({ ...emptyCollege(f.state), city: f.city, collegeTypeId: f.collegeTypeId, affiliation: f.affiliation }));
      setCodeTouched(false);
      nameRef.current?.focus();
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(Object.keys(f).length ? f : { form: fail(err, 'Could not add the college.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="sa-stack-tight" onSubmit={submit} noValidate>
      <div className="sa-grid-form">
        <Field label="College name" error={errors.name} wide>
          <input ref={nameRef} className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Short code" error={errors.code} hint="Unique, e.g. PICT">
          <input
            className="input input-mono"
            value={form.code}
            onChange={(e) => {
              setCodeTouched(true);
              set('code', e.target.value.toUpperCase());
            }}
          />
        </Field>
        <Field label="Type" error={errors.collegeTypeId} hint="Optional">
          <select className="input" value={form.collegeTypeId} onChange={(e) => set('collegeTypeId', e.target.value)}>
            <option value="">Choose…</option>
            {catalogue.collegeTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City" error={errors.city}>
          <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="State" error={errors.state}>
          <select className="input" value={form.state} onChange={(e) => set('state', e.target.value)}>
            <option value="">Choose…</option>
            {catalogue.states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {t.kind !== 'COLLEGE' && (
          <Field label="Affiliation" error={errors.affiliationName}>
            <select
              className="input"
              value={form.affiliation}
              onChange={(e) => set('affiliation', e.target.value as CollegeForm['affiliation'])}
            >
              <option value="THIS_UNIVERSITY">Affiliated to {t.shortName || t.name}</option>
              <option value="AUTONOMOUS">Autonomous</option>
              <option value="OTHER">Affiliated elsewhere</option>
            </select>
          </Field>
        )}
        {form.affiliation === 'OTHER' && (
          <Field label="Affiliated to" error={errors.affiliationName}>
            <input
              className="input"
              value={form.affiliationName}
              onChange={(e) => set('affiliationName', e.target.value)}
            />
          </Field>
        )}
      </div>
      {errors.form && <p className="notice notice-stop">{errors.form}</p>}
      <div className="sa-actions is-inline">
        {note && <span className="od-ok">✓ {note}</span>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add college'}
        </button>
      </div>
    </form>
  );
}

function CollegeSheet({ tenantId, onChange }: { tenantId: string; onChange: (s: OnboardingState) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkCollegesResult | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(f: File) {
    setFile(f);
    setPreview(null);
    setDone(null);
    setError(null);
    setBusy(true);
    try {
      setPreview(await platformApi.bulkColleges(tenantId, f, true));
    } catch (e) {
      setError(fail(e, 'Could not read that file.'));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await platformApi.bulkColleges(tenantId, file, false);
      if (r.state) onChange(r.state);
      setDone(
        `Added ${r.added?.length ?? 0} college${r.added?.length === 1 ? '' : 's'}${r.skipped?.length ? `, skipped ${r.skipped.length} with problems` : ''}.`,
      );
      setPreview(null);
      setFile(null);
    } catch (e) {
      setError(fail(e, 'Could not add the colleges.'));
    } finally {
      setBusy(false);
    }
  }

  const bad = preview?.rows.filter((r) => r.status === 'invalid') ?? [];

  return (
    <div className="sa-stack-tight">
      <ol className="sa-howto">
        <li>
          <button type="button" className="sa-link" onClick={() => platformApi.bulkTemplate('colleges')}>
            Download the template
          </button>{' '}
          and fill one row per college.
        </li>
        <li>Leave the placement officer columns empty for now: anyone listed there is emailed an invitation.</li>
        <li>Upload it. Nothing is added until you confirm.</li>
      </ol>
      <label className="sa-drop">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => e.target.files?.[0] && check(e.target.files[0])}
        />
        {busy && !preview ? 'Reading…' : file ? file.name : 'Choose the filled spreadsheet'}
      </label>

      {preview && (
        <div className="sa-preview">
          <p>
            <b>{preview.summary.valid}</b> ready to add
            {preview.summary.invalid ? (
              <>
                {' '}
                · <b className="is-bad">{preview.summary.invalid}</b> with problems (skipped)
              </>
            ) : null}
            {preview.summary.officers ? ` · ${preview.summary.officers} officers will be emailed` : ''}
          </p>
          {bad.length > 0 && (
            <ul className="sa-problems">
              {bad.slice(0, 8).map((r) => (
                <li key={r.row}>
                  Row {r.row} {r.name && `(${r.name})`}: {r.status === 'invalid' ? r.problems.join(' ') : ''}
                </li>
              ))}
              {bad.length > 8 && <li>…and {bad.length - 8} more.</li>}
            </ul>
          )}
          <div className="sa-actions is-inline">
            <button type="button" className="btn btn-primary" disabled={busy || !preview.summary.valid} onClick={add}>
              {busy ? 'Adding…' : `Add ${preview.summary.valid} colleges`}
            </button>
          </div>
        </div>
      )}
      {done && <p className="od-ok">✓ {done}</p>}
      {error && <p className="notice notice-stop">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Courses                                                                  */
/* -------------------------------------------------------------------------- */

function CoursesStep({
  catalogue,
  state,
  onChange,
  reloadCatalogue,
}: {
  catalogue: Catalogue;
  state: OnboardingState;
  onChange: (s: OnboardingState) => void;
  reloadCatalogue: (c: Catalogue) => void;
}) {
  const t = state.tenant;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(state.programs.map((p) => p.courseId)));
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const courseName = useMemo(() => new Map(catalogue.courses.map((c) => [c.id, c.name])), [catalogue]);
  const shown = catalogue.courses.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  function toggle(id: string) {
    setSaved(false);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function addNew(e: FormEvent) {
    e.preventDefault();
    if (newName.trim().length < 2) return;
    setError(null);
    try {
      const { course } = await platformApi.addCourse(newName.trim(), []);
      reloadCatalogue(await platformApi.catalogue());
      setPicked((p) => new Set(p).add(course.id));
      setSaved(false);
      setNewName('');
    } catch (err) {
      setError(fail(err, 'Could not add that course.'));
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const existing = new Map(state.programs.map((p) => [p.courseId, p.specialisationIds]));
      const fresh = await platformApi.saveAcademics(t.id, {
        oneOfferDefault: t.oneOfferDefault,
        allowSelfJoin: t.allowSelfJoin,
        programs: [...picked].map((courseId) => ({ courseId, specialisationIds: existing.get(courseId) ?? [] })),
      });
      onChange(fresh);
      setSaved(true);
    } catch (err) {
      setError(fail(err, 'Could not save the courses.'));
    } finally {
      setSaving(false);
    }
  }

  const savedIds = state.programs.map((p) => p.courseId);
  const dirty = savedIds.length !== picked.size || savedIds.some((id) => !picked.has(id));

  return (
    <div className="sa-stack">
      <Card
        title={`Courses ${t.shortName || t.name} runs`}
        lede="Pick from the shared list. These are what its colleges and students choose from."
        aside={<span className="sa-count">{picked.size} picked</span>}
      >
        <input
          className="input sa-search"
          type="search"
          placeholder="Search courses"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search courses"
        />
        <ul className="sa-picks">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={picked.has(c.id) ? 'is-on' : ''}
                aria-pressed={picked.has(c.id)}
                onClick={() => toggle(c.id)}
              >
                <span className="sa-tick" aria-hidden="true">
                  {picked.has(c.id) ? '✓' : '+'}
                </span>
                {c.name}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted">No course called “{q}” yet. Add it below.</li>}
        </ul>
        <form className="od-addline" onSubmit={addNew}>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="A course not on the list"
            aria-label="New course name"
          />
          <button type="submit" className="btn btn-secondary" disabled={newName.trim().length < 2}>
            Add to the list
          </button>
        </form>

        {error && <p className="notice notice-stop">{error}</p>}
        <div className="sa-actions is-inline">
          {saved && !dirty && <span className="od-ok">✓ Saved</span>}
          <button type="button" className="btn btn-primary" disabled={saving || picked.size === 0 || !dirty} onClick={save}>
            {saving ? 'Saving…' : 'Save courses'}
          </button>
        </div>
      </Card>

      {state.programs.length > 0 && state.colleges.length > 0 && (
        <CourseMatrix
          tenantId={t.id}
          colleges={state.colleges.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
          courses={state.programs.map((p) => ({ id: p.courseId, name: courseName.get(p.courseId) ?? p.courseName }))}
          onSaved={async () => onChange(await platformApi.state(t.id))}
        />
      )}

      <Card
        title="Next: features"
        lede="What this institution switches on, for its students, colleges and the companies that hire from it. We build this next."
      >
        <span className="sa-soon">Coming next</span>
      </Card>
    </div>
  );
}

/**
 * Which college runs which course: a grid, colleges down, courses across.
 *
 * A college's existing branch-level choices are kept for every course it
 * still runs; a newly ticked course is added as the course as a whole.
 */
function CourseMatrix({
  tenantId,
  colleges,
  courses,
  onSaved,
}: {
  tenantId: string;
  colleges: { id: string; name: string; code: string }[];
  courses: { id: string; name: string }[];
  onSaved: () => Promise<void>;
}) {
  const mapping = useMemo(() => platformMapping(tenantId), [tenantId]);
  const [initial, setInitial] = useState<Map<string, Set<string>> | null>(null);
  const [grid, setGrid] = useState<Map<string, Set<string>>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const byName = useMemo(() => new Map(courses.map((c) => [c.name, c.id])), [courses]);

  useEffect(() => {
    mapping
      .summary()
      .then(({ colleges: rows }) => {
        const m = new Map<string, Set<string>>();
        for (const r of rows) {
          m.set(r.id, new Set(r.courses.map((c) => byName.get(c.course)).filter(Boolean) as string[]));
        }
        setInitial(m);
        setGrid(new Map([...m].map(([k, v]) => [k, new Set(v)])));
      })
      .catch((e) => setError(fail(e, 'Could not load which college runs which course.')));
  }, [mapping, byName]);

  const has = (collegeId: string, courseId: string) => grid.get(collegeId)?.has(courseId) ?? false;

  function flip(collegeId: string, courseId: string) {
    setNote(null);
    setGrid((g) => {
      const n = new Map(g);
      const row = new Set(n.get(collegeId) ?? []);
      if (row.has(courseId)) row.delete(courseId);
      else row.add(courseId);
      n.set(collegeId, row);
      return n;
    });
  }

  function column(courseId: string) {
    const all = colleges.every((c) => has(c.id, courseId));
    setNote(null);
    setGrid((g) => {
      const n = new Map(g);
      for (const c of colleges) {
        const row = new Set(n.get(c.id) ?? []);
        if (all) row.delete(courseId);
        else row.add(courseId);
        n.set(c.id, row);
      }
      return n;
    });
  }

  const changed = colleges.filter((c) => {
    const a = initial?.get(c.id) ?? new Set();
    const b = grid.get(c.id) ?? new Set();
    return a.size !== b.size || [...a].some((x) => !b.has(x));
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const c of changed) {
        const scope = mapping.forCollege(c.id);
        const want = grid.get(c.id) ?? new Set<string>();
        const current = await scope.programs();
        const kept: ProgramChoice[] = current
          .filter((p) => want.has(p.courseId))
          .map((p) => ({ courseId: p.courseId, branchId: p.branchId, intake: p.intake }));
        const covered = new Set(kept.map((p) => p.courseId));
        for (const courseId of want) if (!covered.has(courseId)) kept.push({ courseId, branchId: null });
        await scope.savePrograms(kept);
      }
      setInitial(new Map([...grid].map(([k, v]) => [k, new Set(v)])));
      setNote(`Saved ${changed.length} college${changed.length === 1 ? '' : 's'}.`);
      await onSaved();
    } catch (e) {
      setError(fail(e, 'Could not save. Some colleges may not have been updated.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Which college runs which course"
      lede="Tick the courses each college teaches. Click a course name to tick it for every college."
    >
      {error && <p className="notice notice-stop">{error}</p>}
      {!initial && !error && <p className="muted">Loading…</p>}
      {initial && (
        <div className="sa-matrix-wrap">
          <table className="sa-matrix">
            <thead>
              <tr>
                <th>College</th>
                {courses.map((c) => (
                  <th key={c.id}>
                    <button type="button" onClick={() => column(c.id)} title="Tick for every college">
                      {c.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colleges.map((col) => (
                <tr key={col.id}>
                  <th scope="row">
                    <span>{col.name}</span>
                    <code>{col.code}</code>
                  </th>
                  {courses.map((c) => (
                    <td key={c.id}>
                      <input
                        type="checkbox"
                        checked={has(col.id, c.id)}
                        onChange={() => flip(col.id, c.id)}
                        aria-label={`${col.name} runs ${c.name}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="sa-actions is-inline">
        {note && <span className="od-ok">✓ {note}</span>}
        <button type="button" className="btn btn-primary" disabled={saving || changed.length === 0} onClick={save}>
          {saving ? 'Saving…' : changed.length ? `Save ${changed.length} college${changed.length === 1 ? '' : 's'}` : 'Saved'}
        </button>
      </div>
    </Card>
  );
}
