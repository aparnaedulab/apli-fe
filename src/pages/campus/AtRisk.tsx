import { useCallback, useEffect, useMemo, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { opsApi, type RiskKey, type StalledStudent } from '../../api/ops';
import { useAuth } from '../../auth/AuthContext';
import './AtRisk.css';

const LABEL: Record<RiskKey, string> = {
  not_verified: 'Not verified',
  not_applying: 'Not applying',
  repeated_rejections: 'Repeated rejections',
  profile_incomplete: 'Profile incomplete',
  inactive: 'Not signing in',
  not_placed: 'Not placed yet',
};

/** Worst first: what stops a student outright, then what slows them down. */
const ORDER: RiskKey[] = ['not_verified', 'not_applying', 'repeated_rejections', 'profile_incomplete', 'inactive', 'not_placed'];

/**
 * Students who have stalled, early enough to help.
 *
 * Every name is here for a stated reason, so the conversation with the
 * student can start from it. "Send a note" delivers a kind, specific message
 * from the placement cell - the student never sees how they came to be on
 * this list.
 */
export default function AtRisk() {
  const { hasModule, can } = useAuth();
  const on = hasModule('ops.atRisk') && can('student:read');
  const mayNudge = can('student:write');

  const [data, setData] = useState<Awaited<ReturnType<typeof opsApi.atRisk>> | null>(null);
  const [batchId, setBatchId] = useState('');
  const [only, setOnly] = useState<RiskKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setData(await opsApi.atRisk(batchId || undefined));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the list.');
    }
  }, [batchId]);

  useEffect(() => {
    if (on) void load();
  }, [on, load]);

  const counts = useMemo(() => {
    const c = new Map<RiskKey, number>();
    for (const s of data?.students ?? []) for (const f of s.flags) c.set(f.key, (c.get(f.key) ?? 0) + 1);
    return c;
  }, [data]);

  const shown = (data?.students ?? []).filter((s) => !only || s.flags.some((f) => f.key === only));

  async function nudge(s: StalledStudent) {
    try {
      const r = await opsApi.nudge(s.candidateId);
      setSent((m) => ({ ...m, [s.candidateId]: `Sent: “${r.title}”` }));
    } catch (err) {
      setSent((m) => ({ ...m, [s.candidateId]: err instanceof ApiError ? err.message : 'Could not send.' }));
    }
  }

  if (!on) {
    return (
      <CampusLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Placement cell</p>
            <h1>Students to check on</h1>
            <p className="page-lede">
              {hasModule('ops.atRisk') ? 'Your role cannot see the student list.' : 'This tool is not switched on for your institution.'}
            </p>
          </div>
        </header>
      </CampusLayout>
    );
  }

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Students to check on</h1>
          <p className="page-lede">
            Students who have stalled, each with the reason, so you can help before the season passes them by. They
            never see this list.
          </p>
        </div>
        <label className="ar-batch">
          <span>Batch</span>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {data?.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {data && (
        <div className="ar-filters" role="radiogroup" aria-label="Show students who are">
          <button type="button" role="radio" aria-checked={only === null} className={only === null ? 'is-on' : ''} onClick={() => setOnly(null)}>
            Everyone <span>{data.students.length}</span>
          </button>
          {ORDER.filter((k) => counts.get(k)).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={only === k} className={only === k ? 'is-on' : ''} onClick={() => setOnly(k)}>
              {LABEL[k]} <span>{counts.get(k)}</span>
            </button>
          ))}
        </div>
      )}

      {data === null && !error && <p className="muted">Loading…</p>}

      {data && data.students.length === 0 && (
        <div className="empty">
          <h2>Nobody has stalled</h2>
          <p>Every student here is verified, active and applying. This list fills itself if that changes.</p>
        </div>
      )}

      <ul className="ar-list">
        {shown.map((s) => (
          <li key={s.candidateId} className="card ar-row">
            <div className="ar-who">
              <strong>{s.name}</strong>
              <small>
                {s.batches.map((b) => b.name).join(', ')} · profile {s.completion}%
              </small>
            </div>
            <ul className="ar-reasons">
              {s.flags
                .slice()
                .sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
                .map((f) => (
                  <li key={f.key}>
                    <span className={`pill ${f.weight >= 3 ? 'pill-stop' : f.weight === 2 ? 'pill-hold' : 'pill-idle'}`}>{LABEL[f.key]}</span>
                    {f.reason}
                  </li>
                ))}
            </ul>
            {mayNudge && (
              <div className="ar-act">
                {sent[s.candidateId] ? (
                  <small className="muted">{sent[s.candidateId]}</small>
                ) : (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => nudge(s)}>
                    Send a note
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {data && (
        <p className="muted ar-rules">
          How the list is made: profile under {data.rules.completionBelow}% complete · record not verified · eligible for{' '}
          {data.rules.idleOpenRoles}+ open roles with no application in {data.rules.idleDays} days · not selected{' '}
          {data.rules.rejectionsWithoutOffer}+ times with no offer · no sign-in for {data.rules.inactiveDays} days · not
          placed in an open final drive.
        </p>
      )}
    </CampusLayout>
  );
}
