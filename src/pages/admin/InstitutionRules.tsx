import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { ApiError } from '../../api/client';
import { gapsApi, type InstitutionRules as Rules } from '../../api/gaps';
import { useAuth } from '../../auth/AuthContext';
import { Toggle } from '../platform/ui';
import './InstitutionRules.css';

const DAYS = [3, 5, 7, 10, 14, 21, 30];

/**
 * The placement rules set in onboarding step two, changeable afterwards.
 *
 * Same four settings and the same words as onboarding, so an admin who set
 * them once recognises them. Changes apply from now on: drives already
 * running keep the one-offer rule they started with, which the page says,
 * because moving a live drive's rule silently would surprise its students.
 */
export default function InstitutionRules() {
  const { can } = useAuth();
  const canEdit = can('settings:write');
  const [saved, setSaved] = useState<Rules | null>(null);
  const [draft, setDraft] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    gapsApi
      .rules()
      .then((r) => {
        setSaved(r);
        setDraft(r);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the rules.'));
  }, []);

  const set = <K extends keyof Rules>(key: K, value: Rules[K]) => {
    setDone(false);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const changed = saved && draft ? (Object.keys(draft) as (keyof Rules)[]).filter((k) => draft[k] !== saved[k]) : [];

  const save = async () => {
    if (!draft || changed.length === 0 || saving || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const next = await gapsApi.saveRules(Object.fromEntries(changed.map((k) => [k, draft[k]])));
      setSaved(next);
      setDraft(next);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/⌘+Enter saves, as it does in onboarding.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Placement rules</h1>
          <p className="page-lede">
            How placement works across every college in your institution. These were set during onboarding; change them here.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {done && <p className="alert alert-ok">Saved. New seasons and applications follow these rules from now on.</p>}
      {!canEdit && draft && (
        <p className="muted">Your role can see these rules but not change them. Ask someone with settings access.</p>
      )}

      <section className="card">
        {draft === null ? (
          <p className="muted">{error ? '' : 'Loading…'}</p>
        ) : (
          <div className="rules-toggles">
            <Toggle
              checked={draft.oneOfferDefault}
              onChange={(v) => set('oneOfferDefault', v)}
              disabled={!canEdit}
              label="One offer, then you’re out"
              description="New seasons start with this on: a student who accepts an offer is withdrawn from the rest. Each season can still change it."
            />
            <Toggle
              checked={draft.allowSelfJoin}
              onChange={(v) => set('allowSelfJoin', v)}
              disabled={!canEdit}
              label="Students can join with a batch code"
              description="Placement cells may share a code so students register themselves. Off means every student is entered by the college."
            />
            <Toggle
              checked={draft.unverifiedCompanyAccess}
              onChange={(v) => set('unverifiedCompanyAccess', v)}
              disabled={!canEdit}
              label="Companies can sign in while we check them"
              description="Off (usual): a company that registers waits for Apli.ai to verify it before it can sign in at all. On: it gets in at once and can draft, but still reaches none of your colleges until it is verified."
            />
            <Toggle
              checked={draft.companyApprovalRequired}
              onChange={(v) => set('companyApprovalRequired', v)}
              disabled={!canEdit}
              label="Companies need our approval first"
              description="On top of the platform's verification, the institution approves each company before it can send roles to any of its colleges. Off means each college's approval of each role is the gate."
            />
            <div className="rules-days">
              <span className="toggle-text">
                <span className="toggle-label">Company response time</span>
                <span className="toggle-desc">
                  Days a company has to answer an application before students and the placement cell see it as overdue.
                </span>
              </span>
              <select
                className="input"
                value={draft.responseDays}
                disabled={!canEdit}
                onChange={(e) => set('responseDays', Number(e.target.value))}
                aria-label="Company response time in days"
              >
                {/* A value set some other way still shows, rather than jumping to the nearest option. */}
                {(DAYS.includes(draft.responseDays) ? DAYS : [...DAYS, draft.responseDays].sort((a, b) => a - b)).map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {canEdit && draft && (
        <div className="rules-foot">
          <p className="muted">
            {changed.length === 0
              ? 'No changes.'
              : `${changed.length} ${changed.length === 1 ? 'change' : 'changes'} not saved yet. Seasons already running keep the one-offer rule they started with.`}
          </p>
          <button type="button" className="btn btn-primary" disabled={changed.length === 0 || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save rules'}
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
