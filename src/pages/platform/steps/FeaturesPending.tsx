import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { platformApi } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { StepFooter, Toggle } from '../ui';

/** One tab per kind of person the features are for. Students is the first decided. */
const TABS = [{ key: 'students', label: 'Students' }] as const;
type Tab = (typeof TABS)[number]['key'];

/**
 * What a university switches on, a tab at a time.
 *
 * Only Students is decided so far: whether a student who signs up at one of
 * its colleges gets a welcome email. The rest of the features are still
 * being worked out and arrive as tabs beside it.
 */
export default function FeaturesPending({ state, onSaved, goto }: StepProps) {
  const navigate = useNavigate();
  const t = state!.tenant;
  const [tab, setTab] = useState<Tab>('students');
  const [welcomeEmail, setWelcomeEmail] = useState(t.studentWelcomeEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = welcomeEmail !== t.studentWelcomeEmail;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await platformApi.saveStudentSettings(t.id, { welcomeEmail }));
      navigate('/platform');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the student settings.');
      setBusy(false);
    }
  }

  return (
    <>
      <div className="seg ft-tabs" role="tablist" aria-label="Features">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            className={`seg-opt ${tab === x.key ? 'is-on' : ''}`}
            onClick={() => setTab(x.key)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'students' && (
        <section className="blk">
          <h2 className="blk-title">When a student signs up</h2>
          <p className="blk-sub">
            For students who pick one of {t.shortName || t.name}’s colleges when they create their account.
          </p>
          <Toggle
            checked={welcomeEmail}
            onChange={setWelcomeEmail}
            label="Send a welcome email"
            description={
              welcomeEmail
                ? 'Each new student gets one email saying their account is ready, with a link to sign in. Nothing else is sent.'
                : 'No email is sent. Students are signed in straight away either way.'
            }
          />
        </section>
      )}

      <form onSubmit={save} noValidate>
        <StepFooter
          busy={busy}
          error={error}
          onBack={() => goto('interests')}
          submitLabel="Save & finish"
          note={changed ? 'Not saved yet' : null}
        />
      </form>
    </>
  );
}
