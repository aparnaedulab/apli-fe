import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../../api/client';
import type { FieldRule, IntakeView } from '../../../api/intake';
import type { StepProps } from '../Onboarding';
import { StepFooter } from '../ui';
import '../../admin/StudentIntake.css';

/**
 * What this institution records about a student, and who may add one.
 *
 * Its own step, and deliberately before the roster ever comes up, because
 * everything downstream reads the answers: the spreadsheet prints these
 * columns and marks the insisted-on ones, the upload refuses a row missing
 * one, the student's own profile asks for the same set, and the public
 * registration form asks whatever subset is picked here.
 *
 * Not required to launch. The default is exactly what the platform did when
 * the field set was fixed - name, email and mobile required, everything
 * else offered, both the university and its colleges able to add - so an
 * institution that skips this step is no worse off than before it existed.
 * The institution's own admins can change it later on the same screen.
 */

const RULES: { value: FieldRule; label: string; hint: string }[] = [
  { value: 'off', label: 'Not collected', hint: 'The column disappears from every form and sheet.' },
  { value: 'optional', label: 'Optional', hint: 'Offered, and a blank is fine.' },
  { value: 'required', label: 'Required', hint: 'A row without it is refused.' },
];

export default function StudentsStep({ state, onSaved, goto }: StepProps) {
  const id = state?.tenant.id;
  const [view, setView] = useState<IntakeView | null>(null);
  const [draft, setDraft] = useState<IntakeView['policy'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api
      .get<IntakeView>(`/platform/tenants/${id}/student-intake`)
      .then((v) => {
        setView(v);
        setDraft(v.policy);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load these settings.'),
      );
  }, [id]);

  useEffect(load, [load]);

  function set<K extends keyof IntakeView['policy']>(key: K, value: IntakeView['policy'][K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function setField(key: string, rule: FieldRule) {
    setDraft((d) =>
      d
        ? {
            ...d,
            fields: { ...d.fields, [key]: rule },
            // A field nobody collects cannot be asked for at registration.
            selfFields: rule === 'off' ? d.selfFields.filter((k) => k !== key) : d.selfFields,
          }
        : d,
    );
  }

  async function save(andGo?: boolean) {
    if (!draft || !id || saving) return;
    setError(null);
    setSaving(true);
    try {
      const next = await api.put<IntakeView & { tenant?: unknown }>(
        `/platform/tenants/${id}/student-intake`,
        draft,
      );
      setView(next);
      setDraft(next.policy);
      // The response carries the refreshed onboarding state alongside the
      // policy, so the journey on the left ticks this step off.
      onSaved(next as unknown as Parameters<typeof onSaved>[0], andGo ? 'features' : undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these settings.');
    } finally {
      setSaving(false);
    }
  }

  if (!view || !draft) return <p className="muted">{error ?? 'Loading…'}</p>;

  const askable = view.fields.filter((f) => f.selfAskable && draft.fields[f.key] !== 'off');
  const nobody = !draft.universityMayAdd && !draft.collegeMayAdd && !draft.selfRegister;

  return (
    <form
      className="si"
      onSubmit={(e) => {
        e.preventDefault();
        void save(true);
      }}
      noValidate
    >

      <section className="si-block">
        <h3>Who puts students on the roster</h3>
        <p className="si-lede">
          Whatever is switched off here is closed on the server too, not only hidden — somebody
          who tries anyway is told who does it instead.
        </p>

        <div className="si-who">
          <Check
            on={draft.universityMayAdd}
            onChange={(v) => set('universityMayAdd', v)}
            label="The university"
            hint="Roster entry from its own console, for any of its colleges."
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
            hint="A Register link on the public site. Students type their college code to find it."
          />
        </div>

        {nobody && (
          <p className="alert alert-error">
            Somebody has to be able to add students. Allow the university, its colleges, or
            registration.
          </p>
        )}
      </section>

      <section className="si-block">
        <h3>What this university records</h3>
        <p className="si-lede">
          One list, used everywhere: the class-list spreadsheet, the upload, and the student’s own
          profile.
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
                  <span className="si-locked">Always required</span>
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

      {draft.selfRegister && (
        <section className="si-block">
          <h3>What a student is asked when they register</h3>
          <p className="si-lede">
            A name, an email and a password are always asked. Tick what else. A student who
            registers without a programme is invisible to every role that filters on a course, so
            it is worth asking for one.
          </p>

          <div className="si-pickers">
            {askable.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`si-pick ${draft.selfFields.includes(f.key) ? 'is-on' : ''}`}
                aria-pressed={draft.selfFields.includes(f.key)}
                onClick={() =>
                  set(
                    'selfFields',
                    draft.selfFields.includes(f.key)
                      ? draft.selfFields.filter((k) => k !== f.key)
                      : [...draft.selfFields, f.key],
                  )
                }
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
            hint="They can register and fill in a profile either way. Applying always needs the college to verify them."
          />
        </section>
      )}

      <StepFooter
        onBack={() => goto('batches')}
        busy={saving || nobody}
        submitLabel={saving ? 'Saving…' : 'Save and continue'}
        error={error}
        note="Optional. Left alone, this university gets what every institution got before there was a choice."
      />
    </form>
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
