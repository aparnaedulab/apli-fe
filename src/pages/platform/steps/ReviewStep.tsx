import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { platformApi } from '../../../api/platform';
import { useAuth } from '../../../auth/AuthContext';
import type { StepProps } from '../Onboarding';

/**
 * The last look before an institution goes live.
 *
 * The checklist is the server's, not recomputed here: the same function
 * decides whether "Launch" is allowed, so what this screen says is ready is
 * exactly what the server will accept.
 */
export default function ReviewStep({ state, catalogue, onSaved, goto }: StepProps) {
  const s = state!;
  const t = s.tenant;
  const { actAs, can } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const required = s.checklist.filter((c) => c.required);
  const ready = required.every((c) => c.done);
  const live = t.status === 'ACTIVE';
  const launched = Boolean(t.launchedAt);
  const moduleNames = catalogue.modules.filter((m) => s.modules.includes(m.key) && !m.core);

  async function launch() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await platformApi.launch(t.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not launch. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: 'ACTIVE' | 'SUSPENDED') {
    setBusy(true);
    setError(null);
    try {
      onSaved(await platformApi.setStatus(t.id, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change that.');
    } finally {
      setBusy(false);
    }
  }

  async function enter() {
    await actAs(t.id);
    navigate('/admin');
  }

  return (
    <div>
      {live && (
        <div className="launched ob-in">
          <div className="launched-glow" aria-hidden="true" />
          <p className="eyebrow">Live</p>
          <h2>{t.shortName || t.name} is open.</h2>
          <p>
            Its admins can sign in now, and its placement officers can start filling rosters. Their portal lives at{' '}
            <code>/t/{t.slug}</code>.
          </p>
          <div className="launched-actions">
            <button type="button" className="btn btn-primary" onClick={enter}>
              Step into their portal
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/platform')}>
              Back to institutions
            </button>
          </div>
        </div>
      )}

      <section className="blk">
        <h2 className="blk-title">{launched ? 'What they have' : 'Before it goes live'}</h2>
        <ol className="checklist">
          {s.checklist.map((c) => (
            <li key={c.step} className={c.done ? 'is-done' : c.required ? 'is-todo' : 'is-optional'}>
              <span className="check-dot" aria-hidden="true">
                {c.done ? '✓' : c.required ? '!' : '–'}
              </span>
              <span className="check-text">
                <strong>
                  {c.label}
                  {!c.required && <span className="f-optional"> optional</span>}
                </strong>
                <small>{c.detail}</small>
              </span>
              <button type="button" className="linkish" onClick={() => goto(c.step)}>
                {c.done ? 'Edit' : 'Fix'}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {moduleNames.length > 0 && (
        <section className="blk">
          <h2 className="blk-title">Beyond the core</h2>
          <div className="chips chips-static">
            {moduleNames.map((m) => (
              <span key={m.key} className={`chip is-static ${m.status === 'live' ? 'is-on' : ''}`} title={m.summary}>
                {m.name}
                {m.status === 'planned' && <small> · phase {m.phase}</small>}
              </span>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="step-error" role="alert">
          {error}
        </p>
      )}

      <div className="step-foot">
        <div className="step-foot-row">
          <button type="button" className="btn btn-ghost" onClick={() => goto('people')}>
            ← Back
          </button>
          <span className="step-foot-note">
            {!launched && !ready && `${required.filter((c) => !c.done).length} left to do`}
            {!launched && ready && !can('settings:write') && 'Launching needs the settings:write permission.'}
          </span>
          {!launched ? (
            <button type="button" className="btn btn-primary btn-launch" disabled={!ready || busy || !can('settings:write')} onClick={launch}>
              {busy ? 'Launching…' : `Launch ${t.shortName || 'institution'}`}
            </button>
          ) : live ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setStatus('SUSPENDED')}>
              Suspend
            </button>
          ) : null}
        </div>
      </div>

      {t.status === 'SUSPENDED' && (
        <div className="notice notice-stop">
          This institution is suspended: its people cannot sign in, and its data is kept.{' '}
          <button type="button" className="linkish" onClick={() => setStatus('ACTIVE')}>
            Reactivate
          </button>
        </div>
      )}
    </div>
  );
}
