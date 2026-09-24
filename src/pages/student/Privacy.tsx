import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { consentApi, type ConsentPurpose } from '../../api/consent';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import './Privacy.css';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * The consent centre: every use of a student's data, asked one at a time.
 *
 * Nothing is pre-ticked and nothing is bundled - the law asks for consent that
 * is specific and withdrawable, and a student should be able to see at a
 * glance what they have agreed to and change it. Two uses are marked as
 * needed to apply, because a company cannot consider an application it is not
 * allowed to read; saying so plainly is kinder than a refusal at the last step.
 */
export default function Privacy() {
  const { hasModule } = useAuth();
  const [params] = useSearchParams();
  const fromApply = params.get('reason') === 'apply';
  const [purposes, setPurposes] = useState<ConsentPurpose[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const enabled = hasModule('compliance.consent');

  useEffect(() => {
    if (!enabled) return;
    consentApi
      .mine()
      .then(setPurposes)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your privacy choices.'));
  }, [enabled]);

  async function set(key: string, granted: boolean) {
    setBusy(key);
    setError(null);
    try {
      setPurposes(await consentApi.set(key, granted));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const missingForApply = (purposes ?? []).filter((p) => p.neededToApply && p.granted !== true);

  async function allowApply() {
    setBusy('apply');
    setError(null);
    try {
      setPurposes(await consentApi.setMany(Object.fromEntries(missingForApply.map((p) => [p.key, true]))));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that. Try again.');
    } finally {
      setBusy(null);
    }
  }

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Privacy</p>
            <h1>Your data</h1>
            <p className="page-lede">Your institution has not switched on the privacy centre yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Privacy</p>
          <h1>How your data is used</h1>
          <p className="page-lede">
            You decide each use separately, and you can change your mind at any time. Nothing is shared for a purpose you
            have not allowed.
          </p>
        </div>
      </header>

      {fromApply && purposes && (
        <div className={`pv-banner ${missingForApply.length ? '' : 'is-ok'}`} role="status">
          {missingForApply.length ? (
            <>
              <p>
                <strong>You were about to apply.</strong> A company can only consider your application if it may see your
                profile and your verified marks. Allow those two below, then go back to the role.
              </p>
              <button type="button" className="btn btn-primary" onClick={allowApply} disabled={busy === 'apply'}>
                {busy === 'apply' ? 'Saving…' : 'Allow what applying needs'}
              </button>
            </>
          ) : (
            <>
              <p>
                <strong>You are ready to apply.</strong> Both are allowed - you can withdraw them here whenever you like.
              </p>
              <Link to="/student/jobs" className="btn btn-primary">
                Back to jobs
              </Link>
            </>
          )}
        </div>
      )}

      {!fromApply && missingForApply.length > 0 && purposes && (
        <div className="pv-banner" role="status">
          <p>You have not yet allowed what applying needs, so you cannot apply to roles.</p>
          <button type="button" className="btn btn-secondary" onClick={allowApply} disabled={busy === 'apply'}>
            {busy === 'apply' ? 'Saving…' : 'Allow what applying needs'}
          </button>
        </div>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {!purposes && !error && <p className="muted">Loading…</p>}

      {purposes && (
        <ul className="consents">
          {purposes.map((p) => (
            <li key={p.key} className={`consent ${p.granted ? 'is-on' : ''}`}>
              <div className="consent-row">
                <div className="consent-text">
                  <p className="consent-title">
                    {p.title}
                    {p.neededToApply && <span className="pill pill-hold">Needed to apply</span>}
                  </p>
                  <p className="consent-explain">{p.explain}</p>
                  <p className="consent-when">
                    {p.changedAt
                      ? `${p.granted ? 'Allowed' : 'Not allowed'} · ${when(p.changedAt)}`
                      : 'Not answered yet - nothing is shared for this.'}
                    {p.history.length > 1 && (
                      <>
                        {' · '}
                        <button type="button" className="consent-link" onClick={() => setOpen(open === p.key ? null : p.key)}>
                          {open === p.key ? 'Hide history' : `History (${p.history.length})`}
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <label className="consent-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={p.granted === true}
                    disabled={busy === p.key}
                    onChange={(e) => set(p.key, e.target.checked)}
                    aria-label={p.title}
                  />
                  <span aria-hidden="true" />
                </label>
              </div>
              {open === p.key && (
                <ol className="consent-history">
                  {p.history.map((h, i) => (
                    <li key={i}>
                      <span className={h.granted ? 'on' : 'off'}>{h.granted ? 'Allowed' : 'Withdrawn'}</span> {when(h.at)}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="card consent-note">
        <h2>What changing your mind does</h2>
        <p className="muted">
          Withdrawing stops any sharing from that moment on. It cannot recall what a company already received for a role you
          applied to before - for that, write to the company, or ask your placement cell to help.
        </p>
      </section>
    </StudentLayout>
  );
}
