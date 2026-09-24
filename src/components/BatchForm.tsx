import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import type { NewBatch } from '../api/campus';
import './BatchForm.css';
import { catalogueApi, type Catalogue } from '../api/catalogue';

/**
 * Creating a batch, from either side of the platform.
 *
 * A college makes its own batches; the university makes them on a college's
 * behalf during onboarding, when nobody at the college has accepted their
 * invitation yet. Both do exactly the same thing, so they share this form and
 * differ only in which endpoint the caller posts to.
 *
 * Nothing is required. Every field describes the group where a single answer
 * happens to exist - true of a degree cohort, not true of "Second year" or a
 * shortlist made for one drive - and is recorded as a default for students
 * added through the batch, not as its definition.
 *
 * A batch with no name typed still gets one, built from whatever was filled in
 * ("B.Tech Computer Science 2026", "Year 2", or an untitled placeholder). It
 * can be renamed later; being made to name it first is not worth blocking on.
 */

export interface BatchDraft {
  name: string;
  course: string;
  specialisation: string;
  graduationYear: string;
  studyYear: string;
  headOfDept: string;
}

export const BLANK_BATCH: BatchDraft = {
  name: '',
  course: '',
  specialisation: '',
  graduationYear: '',
  studyYear: '',
  headOfDept: '',
};

/** Ways colleges actually group students, offered as a starting point. */
const PRESETS: { label: string; hint: string; values: Partial<BatchDraft> }[] = [
  {
    label: 'Degree cohort',
    hint: 'B.Tech CSE, graduating 2026',
    values: { course: 'B.Tech', graduationYear: String(new Date().getFullYear() + 2) },
  },
  {
    label: 'Year of study',
    hint: 'Second year, whatever they are studying',
    values: { name: 'Second year', studyYear: '2' },
  },
  {
    label: 'Department',
    hint: 'Everyone in Mechanical',
    values: { name: 'Mechanical', specialisation: 'Mechanical' },
  },
  {
    label: 'Just a group',
    hint: 'Whoever you need together — fill in nothing if you like',
    values: {},
  },
];

export function toNewBatch(f: BatchDraft): NewBatch {
  return {
    name: f.name.trim() || undefined,
    course: f.course.trim() || undefined,
    specialisation: f.specialisation.trim() || undefined,
    graduationYear: f.graduationYear ? Number(f.graduationYear) : undefined,
    studyYear: f.studyYear ? Number(f.studyYear) : undefined,
    headOfDept: f.headOfDept.trim() || undefined,
  };
}

export interface BatchFormProps {
  /** Posts the batch. The caller decides which endpoint, and to which college. */
  onCreate: (batch: NewBatch) => Promise<unknown>;
  onDone: () => void;
  onCancel?: () => void;
  /** Named when the university is creating on a college's behalf. */
  collegeName?: string;
  /** Drops this component's own card, heading and intro - see AddStudents. */
  bare?: boolean;
}

export default function BatchForm({
  onCreate,
  onDone,
  onCancel,
  collegeName,
  bare = false,
}: BatchFormProps) {
  const [f, setF] = useState<BatchDraft>(BLANK_BATCH);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof BatchDraft) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  // What the server would name it, shown before it does, so nobody is
  // surprised by the name they get for leaving the field alone.
  /*
   * The catalogue operations keeps. A batch typed by hand was how "B.E." and
   * "B.Tech" ended up as two courses that never matched each other.
   */
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);

  useEffect(() => {
    catalogueApi
      .courses()
      .then(setCatalogue)
      .catch(() => setCatalogue({ courses: [], looseBranches: [] }));
  }, []);

  const branchOptions = useMemo(() => {
    if (!catalogue) return [];
    const chosen = catalogue.courses.find((c) => c.name === f.course);
    // Branches nobody assigned to a course are offered whatever is chosen,
    // since narrowing by course would hide them from every form.
    return [...new Set([...(chosen?.branches ?? []), ...catalogue.looseBranches])].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [catalogue, f.course]);

  const suggestion = [f.course, f.specialisation, f.graduationYear]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    || (f.studyYear ? `Year ${f.studyYear}` : '');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    setError(null);
    setSaving(true);
    try {
      await onCreate(toNewBatch(f));
      setF(BLANK_BATCH);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the batch.');
      setSaving(false);
    }
  }

  return (
    <form className={bare ? 'bare-form' : 'card form-card'} onSubmit={onSubmit} noValidate>
      {!bare && (
        <>
          <h2>Add a batch{collegeName ? ` to ${collegeName}` : ''}</h2>
          <p className="muted">
            A batch is whichever students should be treated together — a degree cohort, a year of
            study, a department, or a group invented for one drive. Nothing here is required; fill
            in what you know and change the rest later.
          </p>
        </>
      )}

      {error && <p className="alert alert-error">{error}</p>}

      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="preset"
            disabled={saving}
            // A preset fills the form in; it does not lock anything, so every
            // field stays editable afterwards.
            onClick={() => setF({ ...BLANK_BATCH, ...p.values })}
          >
            <span className="preset-label">{p.label}</span>
            <span className="preset-hint">{p.hint}</span>
          </button>
        ))}
      </div>

      <label className="field">
        <span className="field-label">Batch name</span>
        <input
          value={f.name}
          onChange={(e) => set('name')(e.target.value)}
          autoFocus
          placeholder={suggestion || 'CSE 2026, Second year, Mechanical…'}
          disabled={saving}
        />
        <span className="field-hint">
          {suggestion && !f.name.trim()
            ? `Leave it blank and this will be called “${suggestion}”. You can rename it later.`
            : 'Whatever the placement cell calls this group. It is what students and seasons will show.'}
        </span>
      </label>

      <div className="form-row">
        <label className="field">
          <span className="field-label">Course</span>
          <select
            value={f.course}
            onChange={(e) => {
              set('course')(e.target.value);
              // The branch belongs to the course; keeping one from the old
              // course would leave a batch describing something that is not
              // offered, and a role filtering on it would match nobody.
              set('specialisation')('');
            }}
            disabled={saving || catalogue === null}
          >
            <option value="">Not stated</option>
            {(catalogue?.courses ?? []).map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {catalogue === null
              ? 'Loading the course list…'
              : catalogue.courses.length === 0
                ? 'No courses set up yet. Operations adds them under Settings.'
                : 'Kept by operations, so every batch and every role means the same thing by it.'}
          </span>
        </label>
        <label className="field">
          <span className="field-label">Branch</span>
          <select
            value={f.specialisation}
            onChange={(e) => set('specialisation')(e.target.value)}
            disabled={saving || branchOptions.length === 0}
          >
            <option value="">Not stated</option>
            {branchOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {f.course && branchOptions.length === 0 && (
            <span className="field-hint">No branches listed for {f.course} yet.</span>
          )}
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">Graduating year</span>
          <input
            type="number"
            value={f.graduationYear}
            onChange={(e) => set('graduationYear')(e.target.value)}
            min={2000}
            max={2100}
            placeholder="2026"
            disabled={saving}
          />
        </label>
        <label className="field">
          <span className="field-label">Year of study</span>
          <select
            value={f.studyYear}
            onChange={(e) => set('studyYear')(e.target.value)}
            disabled={saving}
          >
            <option value="">—</option>
            {['1', '2', '3', '4', '5', '6'].map((n) => (
              <option key={n} value={n}>
                Year {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Head of department</span>
          <input
            value={f.headOfDept}
            onChange={(e) => set('headOfDept')(e.target.value)}
            placeholder="Dr. S. Deshmukh"
            disabled={saving}
          />
        </label>
      </div>

      <p className="field-hint form-note">
        Nothing here is required. Course and year only fill in students added through this batch —
        a student&rsquo;s own course is what decides which roles they are eligible for.
      </p>

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create batch'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
