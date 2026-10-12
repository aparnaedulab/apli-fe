import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type CollegeForm } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { StepFooter, fieldErrors } from '../ui';

/** "Pune Institute of Computer Technology" -> "PICT". */
function suggestCode(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|for|&)$/i.test(w));
  return words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 8);
}

/** Only what a college needs to exist; the rest of CollegeForm stays empty. */
function collegeForm(name: string, code: string, city: string, state: string): CollegeForm {
  return {
    name,
    code,
    city,
    state,
    collegeTypeId: '',
    affiliation: 'THIS_UNIVERSITY',
    affiliationName: '',
    address: '',
    pincode: '',
    naacGrade: '',
    isVerified: false,
    officerName: '',
    officerEmail: '',
  };
}

/**
 * The university's colleges: a list, and a short form to add to it.
 *
 * A college needs a name, a short code and a city to exist; everything else
 * a college has is for later. Many at once can be pasted, one per line.
 */
export default function SimpleCollegesStep({ state, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const colleges = state!.colleges;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [city, setCity] = useState(t.city ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [lines, setLines] = useState('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);

  const uniState = t.state ?? '';

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const next = await platformApi.createCollege(t.id, collegeForm(name.trim(), code.trim(), city.trim(), uniState));
      onSaved(next);
      setName('');
      setCode('');
      setCodeTouched(false);
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (!Object.keys(f).length) setError(err instanceof ApiError ? err.message : 'Could not add the college.');
    } finally {
      setBusy(false);
    }
  }

  /** One per line: name, code, city. A missing code is made from the name. */
  async function addMany() {
    const rows = lines
      .split(/\r?\n/)
      .map((l) => l.split(/\t|,/).map((c) => c.trim()))
      .filter((c) => c[0]);
    if (!rows.length) return;
    setBusy(true);
    setError(null);
    setPasteNote(null);
    let added = 0;
    const failed: string[] = [];
    let latest = null;
    for (const [n = '', c = '', place = ''] of rows) {
      try {
        latest = await platformApi.createCollege(
          t.id,
          collegeForm(n, c || suggestCode(n), place || t.city || '', uniState),
        );
        added += 1;
      } catch (err) {
        failed.push(`${n}: ${err instanceof ApiError ? err.message : 'not added'}`);
      }
    }
    if (latest) onSaved(latest);
    setBusy(false);
    setPasteNote(`Added ${added} of ${rows.length}.`);
    if (failed.length) setError(failed.slice(0, 5).join(' · ') + (failed.length > 5 ? ` · and ${failed.length - 5} more` : ''));
    else setLines('');
  }

  async function remove(id: string) {
    setError(null);
    try {
      onSaved(await platformApi.deleteCollege(t.id, id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that college.');
    }
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (colleges.length === 0) {
      setError('Add at least one college.');
      return;
    }
    goto('academics');
  }

  return (
    <>
      <section className="sc-card">
        {!paste ? (
          <form className="sc-bar" onSubmit={add} noValidate>
            <input
              className="sc-in is-name"
              value={name}
              placeholder="College name"
              aria-label="College name"
              onChange={(e) => {
                setName(e.target.value);
                if (!codeTouched) setCode(suggestCode(e.target.value));
              }}
            />
            <input
              className="sc-in is-code"
              value={code}
              placeholder="Code"
              aria-label="Short code"
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
            />
            <input
              className="sc-in is-city"
              value={city}
              placeholder="City"
              aria-label="City"
              onChange={(e) => setCity(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
              Add
            </button>
          </form>
        ) : (
          <div className="sc-paste">
            <textarea
              className="input"
              rows={5}
              value={lines}
              onChange={(e) => setLines(e.target.value)}
              placeholder={'One per line: name, code, city\nSample College of Engineering, SCOE, Pune'}
              aria-label="Colleges, one per line"
              autoFocus
            />
            <button type="button" className="btn btn-primary" disabled={busy || !lines.trim()} onClick={addMany}>
              {busy ? 'Adding…' : 'Add all'}
            </button>
          </div>
        )}

        <div className="sc-under">
          {errors.name || errors.code || errors.city || errors.state ? (
            <span className="f-error">{errors.name || errors.code || errors.city || errors.state}</span>
          ) : pasteNote ? (
            <span className="f-hint">{pasteNote}</span>
          ) : !uniState ? (
            <span className="f-error">Add the university’s state in step 1 first.</span>
          ) : (
            <span className="f-hint">{paste ? 'Code and city can be left out.' : 'The code is suggested from the name.'}</span>
          )}
          <button type="button" className="linkish" onClick={() => setPaste((v) => !v)}>
            {paste ? 'Add one at a time' : 'Paste a list instead'}
          </button>
        </div>

        {colleges.length === 0 ? (
          <p className="sc-empty">No colleges yet. Add the first one above.</p>
        ) : (
          <ul className="sc-rows">
            {colleges.map((c) => (
              <li key={c.id}>
                <span className="sc-badge">{c.code}</span>
                <span className="sc-name">{c.name}</span>
                <span className="sc-meta">{c.city}</span>
                {c.students === 0 && c.batches === 0 ? (
                  <button
                    type="button"
                    className="sc-x"
                    onClick={() => remove(c.id)}
                    aria-label={`Remove ${c.name}`}
                    title="Remove"
                  >
                    ×
                  </button>
                ) : (
                  <span className="sc-meta">{c.students} students</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={next} noValidate>
        <StepFooter
          busy={false}
          error={error}
          onBack={() => goto('identity')}
          submitLabel="Continue to courses"
          note={colleges.length ? `${colleges.length} college${colleges.length === 1 ? '' : 's'}` : null}
        />
      </form>
    </>
  );
}
