import { useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { onboardDataApi } from '../../../api/onboardData';
import { platformApi, type StudyLevel } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { StepFooter } from '../ui';

export const LEVELS: { key: StudyLevel; label: string; years: number }[] = [
  { key: 'DIPLOMA', label: 'Diploma', years: 3 },
  { key: 'UG', label: 'Undergraduate', years: 3 },
  { key: 'PG', label: 'Postgraduate', years: 2 },
  { key: 'PHD', label: 'PhD', years: 4 },
];
const YEARS = [1, 2, 3, 4, 5, 6];

/**
 * The courses the university runs: a list, and one box to add to it.
 *
 * Each course carries its level and how many years it runs. At sign-up a
 * student picks a level and is offered only that level's courses, and the
 * length turns the year they joined into a batch ("2022 - 2026").
 *
 * Typing a course the shared list already has picks that one, so "MBA" is
 * spelt one way everywhere; a new name is added to the shared list first.
 * Level and length belong to the shared course, so a change here shows for
 * every university that runs it. Branches are left alone.
 */
export default function SimpleCoursesStep({ state, catalogue, onSaved, goto, updateCatalogue }: StepProps) {
  const t = state!.tenant;
  const [picked, setPicked] = useState<string[]>(() => state!.programs.map((p) => p.courseId));
  const [text, setText] = useState('');
  const [level, setLevel] = useState<StudyLevel | ''>('');
  const [years, setYears] = useState<number | ''>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(catalogue.courses.map((c) => [c.id, c])), [catalogue]);
  const byName = useMemo(() => new Map(catalogue.courses.map((c) => [c.name.toLowerCase(), c])), [catalogue]);
  const suggestions = catalogue.courses.filter((c) => !picked.includes(c.id));
  const known = byName.get(text.trim().toLowerCase());
  const missingLevel = picked.filter((id) => !byId.get(id)?.level).length;

  /** Changes a course's level or length on the shared list. */
  async function shape(id: string, data: { level?: StudyLevel | null; years?: number | null }) {
    setBusy(id);
    setError(null);
    try {
      await onboardDataApi.updateCourse(id, data);
      updateCatalogue((c) => ({ ...c, courses: c.courses.map((x) => (x.id === id ? { ...x, ...data } : x)) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change that course.');
    } finally {
      setBusy(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = text.trim();
    if (name.length < 2) return;
    setError(null);
    if (known) {
      if (!picked.includes(known.id)) setPicked((p) => [...p, known.id]);
      // A known course with no level yet takes the one chosen here.
      if (!known.level && level) await shape(known.id, { level, years: years || null });
      setText('');
      return;
    }
    if (!level) {
      setError('Choose the level of the new course.');
      return;
    }
    setBusy('add');
    try {
      const chosenYears = years || LEVELS.find((l) => l.key === level)!.years;
      const { course } = await platformApi.addCourse(name, [], level, chosenYears);
      updateCatalogue((c) =>
        c.courses.some((x) => x.id === course.id) ? c : { ...c, courses: [...c.courses, course] },
      );
      setPicked((p) => (p.includes(course.id) ? p : [...p, course.id]));
      setText('');
      setLevel('');
      setYears('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that course.');
    } finally {
      setBusy(null);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!picked.length) {
      setError('Add at least one course.');
      return;
    }
    if (missingLevel) {
      setError('Choose a level for every course, so students can find theirs.');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const branches = new Map(state!.programs.map((p) => [p.courseId, p.specialisationIds]));
      const next = await platformApi.saveAcademics(t.id, {
        oneOfferDefault: t.oneOfferDefault,
        allowSelfJoin: t.allowSelfJoin,
        programs: picked.map((courseId) => ({ courseId, specialisationIds: branches.get(courseId) ?? [] })),
      });
      onSaved(next, 'interests');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the courses.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="sc-card">
        <form className="sc-bar" onSubmit={add} noValidate>
          <input
            className="sc-in is-name"
            list="sc-courses"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a course, e.g. B.Tech, MBA, B.Com"
            aria-label="Course name"
          />
          <datalist id="sc-courses">
            {suggestions.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          {/* A course already on the list brings its own level and length. */}
          {!known?.level && (
            <>
              <select
                className="sc-in is-level"
                value={level}
                onChange={(e) => {
                  const l = e.target.value as StudyLevel | '';
                  setLevel(l);
                  if (l && !years) setYears(LEVELS.find((x) => x.key === l)!.years);
                }}
                aria-label="Level"
              >
                <option value="">Level</option>
                {LEVELS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
              <select
                className="sc-in is-years"
                value={years}
                onChange={(e) => setYears(e.target.value ? Number(e.target.value) : '')}
                aria-label="Years"
              >
                <option value="">Years</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y} {y === 1 ? 'year' : 'years'}
                  </option>
                ))}
              </select>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy === 'add' || text.trim().length < 2}>
            Add
          </button>
        </form>
        <div className="sc-under">
          <span className="f-hint">
            Pick from the suggestions, or type a new course with its level and length. Students see only the courses of
            the level they pick.
          </span>
        </div>

        {picked.length === 0 ? (
          <p className="sc-empty">No courses yet. Add the first one above.</p>
        ) : (
          <ul className="sc-rows sc-course-rows">
            {picked.map((id) => {
              const c = byId.get(id);
              return (
                <li key={id} className={c?.level ? '' : 'is-missing'}>
                  <span className="sc-name">{c?.name ?? 'Course'}</span>
                  <select
                    className="sc-mini"
                    value={c?.level ?? ''}
                    disabled={busy === id}
                    onChange={(e) => {
                      const l = (e.target.value || null) as StudyLevel | null;
                      shape(id, { level: l, ...(l && !c?.years ? { years: LEVELS.find((x) => x.key === l)!.years } : {}) });
                    }}
                    aria-label={`Level of ${c?.name ?? 'course'}`}
                  >
                    <option value="">Choose level</option>
                    {LEVELS.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="sc-mini is-years"
                    value={c?.years ?? ''}
                    disabled={busy === id}
                    onChange={(e) => shape(id, { years: e.target.value ? Number(e.target.value) : null })}
                    aria-label={`Years of ${c?.name ?? 'course'}`}
                  >
                    <option value="">Years</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y} {y === 1 ? 'year' : 'years'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="sc-x"
                    onClick={() => setPicked((p) => p.filter((x) => x !== id))}
                    aria-label={`Remove ${c?.name ?? 'course'}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form onSubmit={save} noValidate>
        <StepFooter
          busy={busy === 'save'}
          error={error}
          onBack={() => goto('colleges')}
          submitLabel="Save & continue"
          note={
            missingLevel
              ? `${missingLevel} course${missingLevel === 1 ? '' : 's'} need${missingLevel === 1 ? 's' : ''} a level`
              : picked.length
                ? `${picked.length} course${picked.length === 1 ? '' : 's'}`
                : null
          }
        />
      </form>
    </>
  );
}
