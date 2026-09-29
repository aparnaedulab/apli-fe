import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { intakeApi, type FieldRule, type IntakeView } from '../../api/intake';
import './StudentIntake.css';

/**
 * The three questions to settle before anybody uploads a roster.
 *
 *   What do we record about a student?
 *   Which of those do we insist on?
 *   Who puts them on the roster - us, our colleges, or the students?
 *
 * Every screen downstream reads the answers: the spreadsheet prints only
 * the chosen columns and marks the insisted-on ones, the upload refuses a
 * row missing one, the student's own profile asks for the same set, and the
 * registration form asks whatever subset was picked here.
 *
 * The field list is served rather than written here, so a field added to the
 * platform turns up on this screen with its own help text.
 */

const RULES: { value: FieldRule; label: string; hint: string }[] = [
  { value: 'off', label: 'Not collected', hint: 'The column disappears from every form and sheet.' },
  { value: 'optional', label: 'Optional', hint: 'Offered, and a blank is fine.' },
  { value: 'required', label: 'Required', hint: 'A row without it is refused.' },
];

export default function StudentIntake({ bare = false }: { bare?: boolean }) {
  const [view, setView] = useState<IntakeView | null>(null);
  const [draft, setDraft] = useState<IntakeView['policy'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    intakeApi
      .get()
      .then((v) => {
        setView(v);
        setDraft(v.policy);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load these settings.'),
      );
  }, []);

  useEffect(load, [load]);

  function set<K extends keyof IntakeView['policy']>(key: K, value: IntakeView['policy'][K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSaved(false);
  }

  function setField(key: string, rule: FieldRule) {
    setDraft((d) => {
      if (!d) return d;
      // A field nobody collects cannot be asked for at registration either.
      const selfFields = rule === 'off' ? d.selfFields.filter((k) => k !== key) : d.selfFields;
      return { ...d, fields: { ...d.fields, [key]: rule }, selfFields };
    });
    setSaved(false);
  }

  function toggleSelf(key: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            selfFields: d.selfFields.includes(key)
              ? d.selfFields.filter((k) => k !== key)
              : [...d.selfFields, key],
          }
        : d,
    );
    setSaved(false);
  }

  async function save() {
    if (!draft || saving) return;
    setError(null);
    setSaving(true);
    try {
      const next = await intakeApi.save(draft);
      setView(next);
      setDraft(next.policy);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these settings.');
    } finally {
      setSaving(false);
    }
  }

  if (!view || !draft) {
    return <p className="muted">{error ?? 'Loading…'}</p>;
  }

  const nobodyCanAdd = !draft.universityMayAdd && !draft.collegeMayAdd && !draft.selfRegister;
  const askable = view.fields.filter((f) => f.selfAskable && draft.fields[f.key] !== 'off');

  return (
    <div className={bare ? 'si' : 'card si'}>
      {!bare && <h2>What we record about a student</h2>}

      {error && <p className="alert alert-error">{error}</p>}

      {/* --- who may add ---------------------------------------------------- */}

      <section className="si-block">
        <h3>Who puts students on the roster</h3>
        <p className="si-lede">
          Turning one off closes that door on the server, not just on the screen — somebody who
          tries anyway is told who does it instead.
        </p>

        <div className="si-who">
          <Check
            on={draft.universityMayAdd}
            onChange={(v) => set('universityMayAdd', v)}
            label="The university"
            hint="Roster entry from this console, for any of its colleges."
          />
          <Check
            on={draft.collegeMayAdd}
            onChange={(v) => set('collegeMayAdd', v)}
            label="Each college"
            hint="A placement cell enters its own students."
          />
          <Check
            on={draft.selfRegister}
            onChange={(v) => set('selfRegister', v)}
            label="Students themselves"
            hint="A Register link on the public site. Students type their college code to find you."
          />
        </div>

        {nobodyCanAdd && (
          <p className="alert alert-error">
            Somebody has to be able to add students. Allow the university, its colleges, or
            registration.
          </p>
        )}
      </section>

      {/* --- the fields ----------------------------------------------------- */}

      <section className="si-block">
        <h3>What we collect</h3>
        <p className="si-lede">
          The same list everywhere: the spreadsheet prints these columns, the upload holds rows to
          them, and a student’s own profile asks for the same things.
        </p>

        {view.warnings.length > 0 && (
          <div className="alert alert-warn">
            {view.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}

        <ul className="si-fields">
          {view.fields.map((f) => {
            const rule = draft.fields[f.key] ?? 'optional';
            return (
              <li key={f.key} className={rule === 'off' ? 'is-off' : ''}>
                <div className="si-field-what">
                  <b>
                    {f.label}
                    {f.readsEligibility && (
                      <span className="si-tag" title="A company can set a bar on this">
                        filtered on
                      </span>
                    )}
                  </b>
                  <small>{f.note}</small>
                </div>

                {f.locked ? (
                  <span className="si-locked" title="A student has to have a name and an email">
                    Always required
                  </span>
                ) : (
                  <div className="si-rules" role="radiogroup" aria-label={f.label}>
                    {RULES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={rule === r.value}
                        title={r.hint}
                        className={`si-rule ${rule === r.value ? 'is-on' : ''} is-${r.value}`}
                        onClick={() => setField(f.key, r.value)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* --- registration --------------------------------------------------- */}

      {draft.selfRegister && (
        <section className="si-block">
          <h3>What a student is asked when they register</h3>
          <p className="si-lede">
            A name, an email and a password are always asked. Tick what else. Anything you marked
            required above is required here too — and a student who registers without a programme
            is invisible to every role that filters on a course, so it is worth asking.
          </p>

          <div className="si-pickers">
            {askable.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`si-pick ${draft.selfFields.includes(f.key) ? 'is-on' : ''}`}
                onClick={() => toggleSelf(f.key)}
                aria-pressed={draft.selfFields.includes(f.key)}
              >
                {f.label}
                {draft.fields[f.key] === 'required' && <i>required</i>}
              </button>
            ))}
          </div>

          <Check
            on={draft.selfNeedsApproval}
            onChange={(v) => set('selfNeedsApproval', v)}
            label="A placement cell confirms them before they count"
            hint="They can register and fill in their profile either way. Applying always needs the college to verify them."
          />
        </section>
      )}

      <div className="btn-row si-save">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="si-saved">Saved</span>}
      </div>
    </div>
  );
}

function Check({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="si-check">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
    </label>
  );
}
