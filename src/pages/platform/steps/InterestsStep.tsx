import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { onboardDataApi, type InterestEntry } from '../../../api/onboardData';
import { platformApi } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { StepFooter } from '../ui';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/**
 * The fields of work students say they want to try at sign-up.
 *
 * It is one list for the whole platform - the same one on Onboard data - so
 * a change here shows for every university's students.
 */
export default function InterestsStep({ state, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const [list, setList] = useState<InterestEntry[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const load = useCallback(() => {
    onboardDataApi
      .interests()
      .then(setList)
      .catch((e) => setError(message(e, 'Could not load the interests.')));
  }, []);

  useEffect(load, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = text.trim();
    if (name.length < 2) return;
    setBusy('add');
    setError(null);
    try {
      await onboardDataApi.addInterest(name);
      setText('');
      load();
    } catch (err) {
      setError(message(err, 'Could not add that interest.'));
    } finally {
      setBusy(null);
    }
  }

  // One a student already picked is hidden, so their answer still reads right.
  async function remove(i: InterestEntry) {
    setBusy(i.id);
    setError(null);
    try {
      if (i.inUse > 0) await onboardDataApi.setInterestActive(i.id, false);
      else await onboardDataApi.removeInterest(i.id);
      load();
    } catch (err) {
      setError(message(err, 'Could not remove that interest.'));
    } finally {
      setBusy(null);
    }
  }

  // A rename carries over to the students who already picked it.
  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const value = editing.value.trim();
    const was = list?.find((i) => i.id === editing.id);
    if (!was || value === was.value) return setEditing(null);
    if (value.length < 2) return setError('Type at least two letters.');
    setBusy(editing.id);
    setError(null);
    try {
      await onboardDataApi.renameInterest(editing.id, value);
      setEditing(null);
      load();
    } catch (err) {
      setError(message(err, 'Could not rename that interest.'));
    } finally {
      setBusy(null);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy('save');
    setError(null);
    try {
      onSaved(await platformApi.completeStep(t.id, 'interests'), 'features');
    } catch (err) {
      setError(message(err, 'Could not save this step.'));
    } finally {
      setBusy(null);
    }
  }

  const shown = (list ?? []).filter((i) => i.isActive);

  return (
    <>
      <section className="sc-card">
        <form className="sc-bar" onSubmit={add} noValidate>
          <input
            className="sc-in is-name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a field, e.g. Marketing, Data, Law"
            aria-label="Skill or interest"
          />
          <button type="submit" className="btn btn-primary" disabled={busy === 'add' || text.trim().length < 2}>
            Add
          </button>
        </form>
        <div className="sc-under">
          <span className="f-hint">
            Students pick up to three of these when they sign up. ✎ renames one, × removes it.
          </span>
        </div>

        {!list && !error && <p className="sc-empty">Loading…</p>}
        {list && shown.length === 0 && <p className="sc-empty">None yet. Students will not be asked.</p>}
        {shown.length > 0 && (
          <ul className="sc-chips">
            {shown.map((i) =>
              editing?.id === i.id ? (
                <li key={i.id} className="is-editing">
                  <form onSubmit={rename} className="sc-edit">
                    <input
                      autoFocus
                      value={editing.value}
                      onChange={(e) => setEditing({ id: i.id, value: e.target.value })}
                      onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                      aria-label={`New name for ${i.value}`}
                    />
                    <button type="submit" className="sc-ok" disabled={busy === i.id} title="Save">
                      ✓
                    </button>
                    <button type="button" className="sc-x" onClick={() => setEditing(null)} title="Cancel">
                      ×
                    </button>
                  </form>
                </li>
              ) : (
                <li key={i.id}>
                  {i.value}
                  <button
                    type="button"
                    className="sc-pen"
                    disabled={busy !== null}
                    onClick={() => {
                      setError(null);
                      setEditing({ id: i.id, value: i.value });
                    }}
                    aria-label={`Edit ${i.value}`}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="sc-x"
                    disabled={busy === i.id}
                    onClick={() => remove(i)}
                    aria-label={`Remove ${i.value}`}
                    title={i.inUse > 0 ? `${i.inUse} picked it - it will be hidden` : 'Remove'}
                  >
                    ×
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <form onSubmit={save} noValidate>
        <StepFooter
          busy={busy === 'save'}
          error={error}
          onBack={() => goto('academics')}
          submitLabel="Save & continue"
          note={shown.length ? `${shown.length} interest${shown.length === 1 ? '' : 's'}` : null}
        />
      </form>
    </>
  );
}
